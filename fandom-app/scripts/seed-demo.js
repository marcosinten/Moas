// SOLO PARA PRUEBAS: crea 3 administradoras (clave demo1234) y 12 integrantes de ejemplo. No usar en produccion.
const db=require('../src/core/db'),{hashPassword}=require('../src/modules/auth/service');
(async()=>{
  await db.migrate();
  for(const [u,n,r] of [['laura','Laura','superadmin'],['sofia','Sofía','admin'],['mia','Mía','admin']])
    if(!(await db.one('SELECT 1 FROM admins WHERE username=$1',[u]))) await db.run('INSERT INTO admins(username,display_name,password_hash,role,must_change_password) VALUES($1,$2,$3,$4,0)',[u,n,hashPassword('demo1234'),r]);
  if(!(await db.one('SELECT 1 FROM members LIMIT 1'))){
    const m=[['Luna','2002-03-14','Ecuador'],['Sol','1999-11-25','México'],['Mar','2005-07-08','Perú'],['Estrella','2001-11-30','Colombia'],['Nube','2003-01-19','Ecuador'],['Coral','2000-09-02','Chile'],
      ['Jade','2004-12-24','Argentina'],['Miel','1998-05-11','México'],['Brisa','2006-02-27','Perú'],['Aurora','2002-08-16','Ecuador'],['Perla','2001-10-05','Venezuela'],['Dalia','2003-06-21','Bolivia']];
    for(const r of m) await db.run("INSERT INTO members(nickname,birth_date,country,joined_at) VALUES($1,$2,$3,'2026-10-01')",r);
  }
  console.log('Listo. Usuarios: laura (superadmin), sofia, mia  |  clave: demo1234');
  await db.close();
})().catch(e=>{console.error('Error:',e.message);process.exit(1);});
