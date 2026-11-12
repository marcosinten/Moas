// Carga automatica: cada carpeta de src/modules con index.js que exporte register(ctx) es un modulo.
const fs=require('fs'),path=require('path');
module.exports=function loadModules(ctx){
  const dir=path.join(__dirname,'..','modules');
  for(const n of fs.readdirSync(dir)){ const f=path.join(dir,n,'index.js');
    if(fs.existsSync(f)){ require(f).register(ctx); console.log('Modulo cargado:',n); } }
};
