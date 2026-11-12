// Uso: npm run create-admin -- usuario "Nombre visible" [superadmin|admin]   (necesita DATABASE_URL en .env o en el entorno)
const crypto=require('crypto'),db=require('../src/core/db'),v=require('../src/core/validate'),{hashPassword}=require('../src/modules/auth/service');
const [,, user,name,role='superadmin']=process.argv, u=v.username(user), n=v.clean(name,60);
(async()=>{
  if(!u||!n||!['superadmin','admin'].includes(role)){console.error('Uso: npm run create-admin -- usuario "Nombre" [superadmin|admin]');process.exit(1);}
  await db.migrate();
  if(await db.one('SELECT 1 FROM admins WHERE username=$1',[u])){console.error('Ese usuario ya existe');process.exit(1);}
  const tmp=crypto.randomBytes(9).toString('base64url');
  await db.run('INSERT INTO admins(username,display_name,password_hash,role) VALUES($1,$2,$3,$4)',[u,n,hashPassword(tmp),role]);
  console.log(`Creada: ${u} (${role})\nClave temporal (se pedira cambiarla): ${tmp}`);
  await db.close();
})().catch(e=>{console.error('Error:',e.message);process.exit(1);});
