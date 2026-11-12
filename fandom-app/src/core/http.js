// Express 4 no captura errores de funciones async: este envoltorio los manda al manejador de errores.
exports.ah=fn=>(req,res,next)=>Promise.resolve().then(()=>fn(req,res,next)).catch(next);
