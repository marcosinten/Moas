// Carga .env si existe (solo para trabajar en local; en el hosting se usan variables de entorno reales).
const fs=require('fs'),path=require('path');
try{ for(const l of fs.readFileSync(path.join(__dirname,'..','..','.env'),'utf8').split(/\r?\n/)){
  const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2'); } }catch{}
module.exports={ port:+process.env.PORT||3000, prod:process.env.NODE_ENV==='production',
 databaseUrl:process.env.DATABASE_URL||'', dbSsl:process.env.DB_SSL!=='false', dbPoolMax:+process.env.DB_POOL_MAX||5,
 sessionHours:+process.env.SESSION_HOURS||12 };
