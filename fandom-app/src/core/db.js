// PostgreSQL (Supabase). Interfaz: db.all(sql,[p]) -> filas | db.one(...) -> fila o undefined | db.run(...) -> resultado
// db.tx(async t => {...}) -> transaccion; "t" tiene los mismos metodos. Parametros: $1, $2, ...
const fs=require('fs'),path=require('path'),{Pool,types}=require('pg'),cfg=require('./config');
if(!cfg.databaseUrl){ console.error('Falta la variable DATABASE_URL (cadena de conexion de Supabase). Mira .env.example'); process.exit(1); }
types.setTypeParser(20,v=>parseInt(v,10)); // bigint (COUNT, SUM) -> numero de JavaScript
const pool=new Pool({connectionString:cfg.databaseUrl,ssl:cfg.dbSsl?{rejectUnauthorized:false}:false,max:cfg.dbPoolMax,
  idleTimeoutMillis:30000,connectionTimeoutMillis:15000});
pool.on('error',e=>console.error('Error en una conexion inactiva de la base:',e.message));
const wrap=c=>({ run:(sql,p=[])=>c.query(sql,p), all:async(sql,p=[])=>(await c.query(sql,p)).rows, one:async(sql,p=[])=>(await c.query(sql,p)).rows[0] });
const db=wrap(pool);
db.tx=async fn=>{ const c=await pool.connect();
  try{ await c.query('BEGIN'); const r=await fn(wrap(c)); await c.query('COMMIT'); return r; }
  catch(e){ try{await c.query('ROLLBACK');}catch{} throw e; } finally{ c.release(); } };
// Migraciones: cada cambio futuro = un archivo nuevo NNN_nombre.sql (nunca editar los viejos).
// Todo ocurre en una transaccion con candado: si dos copias del servidor arrancan a la vez, la segunda espera y no repite nada.
db.migrate=async()=>db.tx(async t=>{
  await t.run('SELECT pg_advisory_xact_lock(727274)');
  await t.run('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())');
  await t.run('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY');
  const dir=path.join(__dirname,'..','migrations');
  for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.sql')).sort()){
    if(await t.one('SELECT 1 FROM schema_migrations WHERE name=$1',[f])) continue;
    await t.run(fs.readFileSync(path.join(dir,f),'utf8'));
    await t.run('INSERT INTO schema_migrations(name) VALUES($1)',[f]);
    console.log('Migracion aplicada:',f);
  }
});
db.close=()=>pool.end();
module.exports=db;
