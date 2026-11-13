const crypto=require('crypto'),db=require('../../core/db'),v=require('../../core/validate'),s=require('./service'),{ah}=require('../../core/http');
exports.register=({app})=>{
  app.post('/api/auth/login',ah(async(req,res)=>{
    const u=v.username(req.body.username),p=typeof req.body.password==='string'?req.body.password:'',k=req.ip+'|'+u;
    if(s.blocked(k)) return res.status(429).json({error:'Demasiados intentos. Espera 15 minutos.'});
    const a=u&&await db.one('SELECT * FROM admins WHERE username=$1 AND active=1',[u]);
    const ok=s.verifyPassword(p,a?a.password_hash:s.DUMMY)&&a;
    if(!ok){ s.fail(k); return res.status(401).json({error:'Usuario o contrasena incorrectos'}); }
    s.tries.delete(k); res.setHeader('Set-Cookie',s.COOKIE(await s.createSession(a.id)));
    res.json({id:a.id,username:a.username,display_name:a.display_name,role:a.role,must_change_password:!!a.must_change_password});
  }));
  app.post('/api/auth/logout',s.requireAuth,ah(async(req,res)=>{ await db.run('DELETE FROM sessions WHERE id=$1',[s.sha(s.readCookie(req,'sid'))]);
    res.setHeader('Set-Cookie','sid=; HttpOnly; Path=/; Max-Age=0'); res.json({ok:true}); }));
  app.get('/api/auth/me',s.requireAuth,(req,res)=>res.json(req.admin));
  app.post('/api/auth/change-password',s.requireAuth,ah(async(req,res)=>{
    const cur=await db.one('SELECT password_hash FROM admins WHERE id=$1',[req.admin.id]), np=v.password(req.body.new_password);
    if(!s.verifyPassword(String(req.body.current_password||''),cur.password_hash)) return res.status(400).json({error:'Contrasena actual incorrecta'});
    if(!np) return res.status(400).json({error:'La nueva contrasena debe tener entre 8 y 128 caracteres'});
    await db.run('UPDATE admins SET password_hash=$1,must_change_password=0 WHERE id=$2',[s.hashPassword(np),req.admin.id]); res.json({ok:true}); }));
  // Lista de administradoras. Sin parametros: solo activas (selector de colaboradoras).
  // ?manage=1 (solo superadmin): todas, con estado y si tienen historial (para la pantalla de administradoras).
  app.get('/api/admins',s.requireAuth,ah(async(req,res)=>{
    if(req.query.manage!=='1') return res.json(await db.all('SELECT id,username,display_name,role,profile_birth_date,profile_country,profile_bias,profile_palette,profile_photo IS NOT NULL AS has_photo FROM admins WHERE active=1 ORDER BY lower(display_name)'));
    if(req.admin.role!=='superadmin') return res.status(403).json({error:'Sin permiso'});
    res.json(await db.all(`SELECT id,username,display_name,role,active,must_change_password,created_at,
      profile_birth_date,profile_country,profile_bias,profile_palette,profile_photo IS NOT NULL AS has_photo,
      ((((SELECT COUNT(*) FROM events WHERE created_by=a.id OR supervisor_id=a.id)+(SELECT COUNT(*) FROM event_collaborators WHERE admin_id=a.id))>0))::int AS has_history
      FROM admins a ORDER BY active DESC, lower(display_name)`));
  }));
  const ROLES=['admin','superadmin'], newTemp=()=>crypto.randomBytes(9).toString('base64url');
  const activeSupers=async(x,exceptId)=>(await x.one("SELECT COUNT(*)::int c FROM admins WHERE role='superadmin' AND active=1 AND id<>$1",[exceptId])).c;
  const hasHistory=async(x,id)=>(await x.one('SELECT ((SELECT COUNT(*) FROM events WHERE created_by=$1 OR supervisor_id=$1)+(SELECT COUNT(*) FROM event_collaborators WHERE admin_id=$1))::int c',[id])).c>0;
  // Elimina; si ya participo en dinamicas/votaciones se da de baja (no se borra) para no romper el historial.
  // "x" es la transaccion (t) desde la que se llama.
  async function removeAdmin(x,id,me){
    const a=await x.one('SELECT * FROM admins WHERE id=$1',[id]);
    if(!a) return {error:'No existe',status:404};
    if(id===me.id) return {error:'No puedes eliminar tu propia cuenta',status:409};
    if(a.role==='superadmin'&&a.active&&!(await activeSupers(x,id))) return {error:'Debe quedar al menos una superadmin activa',status:409};
    if(await hasHistory(x,id)){ await x.run('UPDATE admins SET active=0 WHERE id=$1',[id]); await x.run('DELETE FROM sessions WHERE admin_id=$1',[id]); return {result:'deactivated'}; }
    await x.run('DELETE FROM admins WHERE id=$1',[id]); return {result:'deleted'};
  }
  // Solo la superadmin crea administradoras; recibe una clave temporal que se muestra una sola vez.
  app.post('/api/admins',s.requireAuth,s.requireRole('superadmin'),ah(async(req,res)=>{
    const u=v.username(req.body.username),n=v.clean(req.body.display_name,60),role=req.body.role===undefined?'admin':req.body.role;
    if(!u||!n) return res.status(400).json({error:'Usuario (a-z, 0-9, . _ -; 3-30) y nombre son obligatorios'});
    if(!ROLES.includes(role)) return res.status(400).json({error:'Rol inválido'});
    if(await db.one('SELECT 1 FROM admins WHERE username=$1',[u])) return res.status(409).json({error:'Ese usuario ya existe'});
    const tmp=newTemp();
    const r=await db.one('INSERT INTO admins(username,display_name,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id',[u,n,s.hashPassword(tmp),role]);
    res.status(201).json({id:r.id,username:u,display_name:n,role,temp_password:tmp}); }));
  // Editar nombre, usuario, rol, activa/inactiva; reset_password:true genera una clave temporal nueva.
  app.patch('/api/admins/:id',s.requireAuth,s.requireRole('superadmin'),ah(async(req,res)=>{
    const id=v.id(req.params.id),a=id&&await db.one('SELECT * FROM admins WHERE id=$1',[id]),b=req.body||{};
    if(!a) return res.status(404).json({error:'No existe'});
    const n=b.display_name===undefined?a.display_name:v.clean(b.display_name,60),u=b.username===undefined?a.username:v.username(b.username),
      role=b.role===undefined?a.role:b.role,active=b.active===undefined?a.active:(b.active?1:0);
    if(!n||!u) return res.status(400).json({error:'Usuario (a-z, 0-9, . _ -; 3-30) y nombre son obligatorios'});
    if(!ROLES.includes(role)) return res.status(400).json({error:'Rol inválido'});
    if(await db.one('SELECT 1 FROM admins WHERE username=$1 AND id<>$2',[u,id])) return res.status(409).json({error:'Ese usuario ya existe'});
    if(id===req.admin.id&&(role!=='superadmin'||!active)) return res.status(409).json({error:'No puedes quitarte el rol ni desactivar tu propia cuenta'});
    if(b.reset_password&&id===req.admin.id) return res.status(409).json({error:'Tu contraseña se cambia desde tu cuenta'});
    if(a.role==='superadmin'&&a.active&&(role!=='superadmin'||!active)&&!(await activeSupers(db,id))) return res.status(409).json({error:'Debe quedar al menos una superadmin activa'});
    let tmp=null;
    await db.tx(async t=>{
      await t.run('UPDATE admins SET display_name=$1,username=$2,role=$3,active=$4 WHERE id=$5',[n,u,role,active,id]);
      if(!active) await t.run('DELETE FROM sessions WHERE admin_id=$1',[id]);
      if(b.reset_password===true){ tmp=newTemp(); await t.run('UPDATE admins SET password_hash=$1,must_change_password=1 WHERE id=$2',[s.hashPassword(tmp),id]); await t.run('DELETE FROM sessions WHERE admin_id=$1',[id]); }
    });
    res.json({ok:true,temp_password:tmp}); }));
  app.delete('/api/admins/:id',s.requireAuth,s.requireRole('superadmin'),ah(async(req,res)=>{
    const id=v.id(req.params.id); if(!id) return res.status(404).json({error:'No existe'});
    const r=await db.tx(t=>removeAdmin(t,id,req.admin)); if(r.error) return res.status(r.status).json({error:r.error});
    res.json({deleted:r.result==='deleted',deactivated:r.result==='deactivated'}); }));
  // Seleccion multiple: devuelve cuantas se borraron, se dieron de baja y cuales se omitieron (con el motivo).
  app.post('/api/admins/bulk-delete',s.requireAuth,s.requireRole('superadmin'),ah(async(req,res)=>{
    const ids=v.idList(req.body.ids); if(!ids) return res.status(400).json({error:'Selecciona al menos una administradora'});
    const out={deleted:0,deactivated:0,skipped:[]};
    await db.tx(async t=>{ for(const id of ids){ const r=await removeAdmin(t,id,req.admin);
      if(r.error) out.skipped.push({id,reason:r.error}); else out[r.result]++; } });
    res.json(out); }));
};
