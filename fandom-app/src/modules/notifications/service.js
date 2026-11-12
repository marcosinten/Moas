const db=require('../../core/db');
// "x" opcional: pasar la transaccion (t) cuando se llama dentro de una.
exports.notify=(adminId,type,eventId,message,x=db)=>x.run('INSERT INTO notifications(admin_id,type,event_id,message) VALUES($1,$2,$3,$4)',[adminId,type,eventId,message]);
