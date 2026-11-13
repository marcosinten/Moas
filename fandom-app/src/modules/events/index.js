// Dinamicas y votaciones (tabla events, campo kind). Una vez 'finished' todo queda bloqueado; solo se puede eliminar.
const db=require('../../core/db'),v=require('../../core/validate'),{requireAuth}=require('../auth/service'),{notify}=require('../notifications/service'),{ah}=require('../../core/http');
const KN={dynamic:'dinámica',voting:'votación'}, fd=s=>s.split('-').reverse().join('/');
const getEvent=(x,id)=>x.one(`SELECT e.*,c.display_name creator_name,s.display_name supervisor_name FROM events e
  JOIN admins c ON c.id=e.created_by LEFT JOIN admins s ON s.id=e.supervisor_id WHERE e.id=$1`,[id]);
// Completa varias actividades con solo 2 consultas (la base esta en la nube: menos viajes = mas rapido).
async function decorate(rows,me){
  if(!rows.length) return rows;
  const ids=rows.map(r=>r.id);
  const [cols,sums]=await Promise.all([
    db.all(`SELECT ec.event_id,a.id,a.display_name name,ec.status FROM event_collaborators ec JOIN admins a ON a.id=ec.admin_id
      WHERE ec.event_id=ANY($1::int[]) ORDER BY lower(a.display_name)`,[ids]),
    db.all(`SELECT event_id,COALESCE(SUM(participated),0)::int participants,COALESCE(SUM(votes),0)::int total_votes FROM participations
      WHERE event_id=ANY($1::int[]) GROUP BY event_id`,[ids])]);
  for(const e of rows){
    e.collaborators=cols.filter(c=>c.event_id===e.id).map(({id,name,status})=>({id,name,status}));
    const mine=e.collaborators.find(c=>c.id===me.id); e.my_status=mine?mine.status:null;
    e.can_manage=e.status==='scheduled'&&(me.role==='superadmin'||e.created_by===me.id||!!(mine&&mine.status==='confirmed'));
    e.can_delete=me.role==='superadmin'||e.created_by===me.id;
    const s=sums.find(x=>x.event_id===e.id); e.participants=s?s.participants:0; e.total_votes=s?s.total_votes:0;
  }
  return rows;
}
async function parse(b,creatorId){
  const e=[],name=v.clean(b.name,80); if(!name) e.push('El nombre es obligatorio (máx. 80 caracteres)');
  const date=v.isoDate(b.event_date); if(!date) e.push('La fecha es obligatoria y debe ser válida');
  let time=null; if(b.start_time){time=v.hhmm(b.start_time); if(!time) e.push('Hora inválida');}
  let desc=null; if(b.description){desc=v.clean(b.description,1000); if(!desc) e.push('Descripción inválida (máx. 1000 caracteres)');}
  const valid=new Set((await db.all('SELECT id FROM admins WHERE active=1')).map(r=>r.id));
  const ids=new Set((Array.isArray(b.collaborators)?b.collaborators:[]).map(Number));
  ids.delete(creatorId);
  if([...ids].some(i=>!valid.has(i))) e.push('Administradora no válida en colaboradoras');
  const zone=b.opening_zone || null;
  if(zone !== null){
    try {
      if(typeof zone!=='string'||zone.length>80) throw new Error();
      new Intl.DateTimeFormat('es',{timeZone:zone});
    } catch { e.push('Zona horaria inválida'); }
  }
  return {e,name,date,time,desc,zone,ids:[...ids]};
}
const invite=(x,admin,id,kind,name,date,to)=>notify(to,'invite',id,`${admin.display_name} te invita a colaborar en la ${KN[kind]} «${name}» (${fd(date)})`,x);
const load=async(req,res)=>{ const id=v.id(req.params.id), e=id&&await getEvent(db,id); if(!e){res.status(404).json({error:'No existe'});return null;} return (await decorate([e],req.admin))[0]; };
exports.register=({app})=>{
  app.get('/api/events',requireAuth,ah(async(req,res)=>{
    const kind=req.query.kind in KN?req.query.kind:'dynamic',hist=req.query.history==='1';
    const rows=await db.all(`SELECT e.*,c.display_name creator_name,s.display_name supervisor_name FROM events e JOIN admins c ON c.id=e.created_by
      LEFT JOIN admins s ON s.id=e.supervisor_id WHERE e.kind=$1 AND e.status=$2 ORDER BY e.event_date ${hist?'DESC':'ASC'},e.start_time NULLS FIRST,e.id`,[kind,hist?'finished':'scheduled']);
    res.json(await decorate(rows,req.admin));
  }));
  app.get('/api/events/:id',requireAuth,ah(async(req,res)=>{ const e=await load(req,res); if(!e) return;
    e.members=await db.all(`SELECT m.id member_id,m.nickname,m.country,m.active,p.participated,p.votes FROM members m
      LEFT JOIN participations p ON p.member_id=m.id AND p.event_id=$1 WHERE m.active=1 OR p.event_id IS NOT NULL ORDER BY lower(m.nickname)`,[e.id]);
    res.json(e); }));
  app.post('/api/events',requireAuth,ah(async(req,res)=>{
    const kind=req.body.kind; if(!(kind in KN)) return res.status(400).json({error:'Tipo inválido'});
    const p=await parse(req.body,req.admin.id); if(p.e.length) return res.status(400).json({error:p.e.join('. ')});
    const id=await db.tx(async t=>{
      const r=await t.one('INSERT INTO events(kind,name,description,event_date,start_time,created_by,supervisor_id,opening_zone) VALUES($1,$2,$3,$4,$5,$6,$6,$7) RETURNING id',[kind,p.name,p.desc,p.date,p.time,req.admin.id,p.zone]);
      for(const a of p.ids){ await t.run('INSERT INTO event_collaborators(event_id,admin_id) VALUES($1,$2)',[r.id,a]); await invite(t,req.admin,r.id,kind,p.name,p.date,a); }
      return r.id; });
    res.status(201).json({id});
  }));
  app.patch('/api/events/:id',requireAuth,ah(async(req,res)=>{
    const e=await load(req,res); if(!e) return;
    if(e.status==='finished') return res.status(409).json({error:'La actividad ya finalizó: no se puede modificar'});
    if(!e.can_manage) return res.status(403).json({error:'Sin permiso'});
    const p=await parse(req.body,e.created_by); if(p.e.length) return res.status(400).json({error:p.e.join('. ')});
    await db.tx(async t=>{
      await t.run('UPDATE events SET name=$1,description=$2,event_date=$3,start_time=$4,opening_zone=$5 WHERE id=$6',[p.name,p.desc,p.date,p.time,p.zone,e.id]);
      const old=new Set(e.collaborators.map(c=>c.id)),now=new Set(p.ids);
      for(const a of old) if(!now.has(a)) await t.run('DELETE FROM event_collaborators WHERE event_id=$1 AND admin_id=$2',[e.id,a]);
      for(const a of now) if(!old.has(a)){ await t.run('INSERT INTO event_collaborators(event_id,admin_id) VALUES($1,$2)',[e.id,a]); await invite(t,req.admin,e.id,e.kind,p.name,p.date,a); }
    });
    res.json({ok:true});
  }));
  app.delete('/api/events/:id',requireAuth,ah(async(req,res)=>{
    const e=await load(req,res); if(!e) return; if(!e.can_delete) return res.status(403).json({error:'Solo quien la creó o la superadmin puede eliminarla'});
    await db.run('DELETE FROM events WHERE id=$1',[e.id]); res.json({ok:true}); }));
  // Seleccion multiple: elimina las que la usuaria puede eliminar y lista las omitidas.
  app.post('/api/events/bulk-delete',requireAuth,ah(async(req,res)=>{
    const ids=v.idList(req.body.ids); if(!ids) return res.status(400).json({error:'Selecciona al menos un elemento'});
    const out={deleted:0,skipped:[]};
    await db.tx(async t=>{ for(const id of ids){ const e=await t.one('SELECT id,created_by FROM events WHERE id=$1',[id]);
      if(!e){ out.skipped.push({id,reason:'No existe'}); continue; }
      if(!(req.admin.role==='superadmin'||e.created_by===req.admin.id)){ out.skipped.push({id,reason:'Solo quien la creó o la superadmin puede eliminarla'}); continue; }
      await t.run('DELETE FROM events WHERE id=$1',[id]); out.deleted++; } });
    res.json(out);
  }));
  app.post('/api/events/:id/finish',requireAuth,ah(async(req,res)=>{
    const e=await load(req,res); if(!e) return; if(e.status==='finished') return res.status(409).json({error:'Ya estaba finalizada'});
    if(!e.can_manage) return res.status(403).json({error:'Sin permiso'});
    await db.run("UPDATE events SET status='finished' WHERE id=$1",[e.id]); res.json({ok:true}); }));
  app.post('/api/events/:id/respond',requireAuth,ah(async(req,res)=>{
    const e=await load(req,res); if(!e) return; if(e.status!=='scheduled') return res.status(409).json({error:'La actividad ya finalizó'});
    if(!e.my_status) return res.status(403).json({error:'No estás invitada'});
    const ok=req.body.accept===true;
    await db.tx(async t=>{
      await t.run('UPDATE event_collaborators SET status=$1 WHERE event_id=$2 AND admin_id=$3',[ok?'confirmed':'cancelled',e.id,req.admin.id]);
      await t.run("UPDATE notifications SET read_at=now() WHERE admin_id=$1 AND event_id=$2 AND type='invite' AND read_at IS NULL",[req.admin.id,e.id]);
      await notify(e.created_by,'response',e.id,`${req.admin.display_name} ${ok?'aceptó':'rechazó'} colaborar en «${e.name}»`,t);
    });
    res.json({ok:true,status:ok?'confirmed':'cancelled'});
  }));
  // Guarda la lista de participantes (✔/✖) y, en votaciones, los votos (enteros >= 0). Un solo INSERT para todos.
  app.put('/api/events/:id/participations',requireAuth,ah(async(req,res)=>{
    const e=await load(req,res); if(!e) return;
    if(e.status==='finished') return res.status(409).json({error:'La actividad ya finalizó: no se puede modificar'});
    if(!e.can_manage) return res.status(403).json({error:'Sin permiso'});
    const list=Array.isArray(req.body.entries)?req.body.entries:null; if(!list||list.length>1000) return res.status(400).json({error:'Datos inválidos'});
    const ok=new Set((await db.all('SELECT id FROM members WHERE active=1')).map(r=>r.id)),rows=new Map();
    for(const x of list){
      const mid=Number(x.member_id),p=x.participated===true;
      let votes=0; if(p&&e.kind==='voting'){votes=v.votes(x.votes); if(votes===null) return res.status(400).json({error:'Los votos deben ser un número entero de 0 en adelante'});}
      if(!ok.has(mid)) return res.status(400).json({error:'Integrante no válido'}); rows.set(mid,[p?1:0,votes]);
    }
    if(rows.size) await db.run(`INSERT INTO participations(event_id,member_id,participated,votes)
      SELECT $1::int,m,p,vt FROM unnest($2::int[],$3::int[],$4::int[]) AS u(m,p,vt)
      ON CONFLICT(event_id,member_id) DO UPDATE SET participated=EXCLUDED.participated,votes=EXCLUDED.votes`,
      [e.id,[...rows.keys()],[...rows.values()].map(r=>r[0]),[...rows.values()].map(r=>r[1])]);
    res.json({ok:true,saved:rows.size});
  }));
};
