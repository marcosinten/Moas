const db=require('../../core/db'),v=require('../../core/validate'),{requireAuth}=require('../auth/service'),{ah}=require('../../core/http');
const today=()=>new Date().toISOString().slice(0,10);
function parse(b){
  const e=[],nickname=v.clean(b.nickname,40); if(!nickname) e.push('El apodo/nombre es obligatorio (max. 40 caracteres)');
  let birth=null; if(b.birth_date){birth=v.isoDate(b.birth_date); if(!birth||birth>today()||birth<'1940-01-01'){e.push('Fecha de nacimiento invalida');birth=null;}}
  let country=null; if(b.country){country=v.clean(b.country,40); if(!country) e.push('Pais invalido');}
  let joined=today(); if(b.joined_at){joined=v.isoDate(b.joined_at); if(!joined) e.push('Fecha de ingreso invalida');}
  const bias=b.bias ? v.clean(b.bias,60) : null;
  if(b.bias && !bias) e.push('Bias inválido (máx. 60 caracteres)');
  return {e,nickname,birth,country,joined,bias};
}
const key=s=>s.toLocaleLowerCase('es');
const dup=async(n,id)=>(await db.all('SELECT nickname FROM members WHERE id<>$1',[id||0])).some(r=>key(r.nickname)===key(n)); // compara con tildes/ñ
exports.register=({app})=>{
  app.get('/api/members',requireAuth,ah(async(req,res)=>{
    const q=v.clean(String(req.query.q||''),40),c=v.clean(String(req.query.country||''),40),w=[],a=[];
    if(q){a.push('%'+q.replace(/[%_]/g,'')+'%');w.push(`m.nickname ILIKE $${a.length}`);}
    if(c){a.push(c);w.push(`m.country=$${a.length}`);}
    if(req.query.inactive!=='1') w.push('m.active=1');
    res.json(await db.all(`SELECT m.id,m.nickname,m.birth_date,m.country,m.joined_at,m.active,m.bias,m.created_by,a.display_name creator_name
      FROM members m LEFT JOIN admins a ON a.id=m.created_by
      ${w.length?'WHERE '+w.join(' AND '):''} ORDER BY lower(m.nickname)`,a));
  }));
  app.get('/api/members/countries',requireAuth,ah(async(req,res)=>res.json((await db.all("SELECT DISTINCT country FROM members WHERE country IS NOT NULL ORDER BY country")).map(r=>r.country))));
  app.post('/api/members',requireAuth,ah(async(req,res)=>{
    const p=parse(req.body); if(p.e.length) return res.status(400).json({error:p.e.join('. ')});
    if(await dup(p.nickname)) return res.status(409).json({error:'Ya existe un integrante con ese apodo'});
    const r=await db.one('INSERT INTO members(nickname,birth_date,country,joined_at,created_by,bias) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[p.nickname,p.birth,p.country,p.joined,req.admin.id,p.bias]);
    res.status(201).json({id:r.id});
  }));
  app.patch('/api/members/:id',requireAuth,ah(async(req,res)=>{
    const id=v.id(req.params.id); if(!id||!(await db.one('SELECT 1 FROM members WHERE id=$1',[id]))) return res.status(404).json({error:'No existe'});
    const p=parse(req.body); if(p.e.length) return res.status(400).json({error:p.e.join('. ')});
    if(await dup(p.nickname,id)) return res.status(409).json({error:'Ya existe un integrante con ese apodo'});
    await db.run('UPDATE members SET nickname=$1,birth_date=$2,country=$3,joined_at=$4,active=$5,bias=CASE WHEN $7 THEN $8::varchar ELSE bias END WHERE id=$6',[p.nickname,p.birth,p.country,p.joined,req.body.active===false?0:1,id,req.body.bias!==undefined,p.bias]);
    res.json({ok:true});
  }));
  // Si ya tiene historial de participaciones se da de baja (no se borra) para no dañar las estadisticas.
  const removeMember=async(x,id)=>{
    if(!(await x.one('SELECT 1 FROM members WHERE id=$1',[id]))) return null;
    if(await x.one('SELECT 1 FROM participations WHERE member_id=$1 LIMIT 1',[id])){ await x.run('UPDATE members SET active=0 WHERE id=$1',[id]); return 'deactivated'; }
    await x.run('DELETE FROM members WHERE id=$1',[id]); return 'deleted';
  };
  app.delete('/api/members/:id',requireAuth,ah(async(req,res)=>{
    const id=v.id(req.params.id), r=id&&await db.tx(t=>removeMember(t,id)); if(!r) return res.status(404).json({error:'No existe'});
    res.json({[r]:true});
  }));
  // Seleccion multiple
  app.post('/api/members/bulk-delete',requireAuth,ah(async(req,res)=>{
    const ids=v.idList(req.body.ids); if(!ids) return res.status(400).json({error:'Selecciona al menos un integrante'});
    const out={deleted:0,deactivated:0,missing:0};
    await db.tx(async t=>{ for(const id of ids){ const r=await removeMember(t,id); if(r) out[r]++; else out.missing++; } });
    res.json(out);
  }));
};
