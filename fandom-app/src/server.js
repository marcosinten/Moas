const express=require('express'),path=require('path'),cfg=require('./core/config'),db=require('./core/db'),{ah}=require('./core/http');
const app=express(); app.disable('x-powered-by'); app.set('trust proxy',1); app.use(express.json({limit:'100kb'}));
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');next();});
// Tambien lo usa el monitor externo (UptimeRobot) para mantener despierto el servidor y activa la base de Supabase.
app.get('/api/health',ah(async(req,res)=>{await db.one('SELECT 1 AS ok');res.json({ok:true});}));
require('./core/modules')({app,db});
app.use(express.static(path.join(__dirname,'..','public')));
app.use('/api',(req,res)=>res.status(404).json({error:'No encontrado'}));
app.use((err,req,res,next)=>{
  // Errores de restriccion de Postgres: unico, relacion, CHECK.
  if(err.code==='23505') return res.status(409).json({error:'Ya existe un registro con esos datos'});
  if(err.code==='23503') return res.status(409).json({error:'No se puede por tener datos relacionados'});
  if(err.code==='23514'||err.code==='22P02'||err.code==='22003') return res.status(400).json({error:'Datos invalidos'});
  console.error(err); res.status(err.status||500).json({error:err.status<500?'Solicitud invalida':'Error interno'});
});
(async()=>{
  await db.migrate();
  const clean=()=>db.run('DELETE FROM sessions WHERE expires_at<now()').catch(e=>console.error('Limpieza de sesiones:',e.message));
  clean(); setInterval(clean,36e5).unref();
  const srv=app.listen(cfg.port,()=>console.log('Servidor en puerto',cfg.port));
  const stop=()=>srv.close(async()=>{await db.close();process.exit(0);}); process.on('SIGTERM',stop); process.on('SIGINT',stop);
})().catch(e=>{console.error('No se pudo iniciar:',e.message);process.exit(1);});
