const db=require('../../core/db'),{requireAuth}=require('../auth/service'),{ah}=require('../../core/http');
exports.register=({app})=>{
  app.get('/api/notifications',requireAuth,ah(async(req,res)=>{
    const [items,u]=await Promise.all([db.all(`SELECT n.id,n.type,n.event_id,n.message,n.read_at,n.created_at,e.kind,
      CASE WHEN n.type='invite' AND e.status='scheduled' AND ec.status='pending' THEN 1 ELSE 0 END AS can_respond
      FROM notifications n LEFT JOIN events e ON e.id=n.event_id
      LEFT JOIN event_collaborators ec ON ec.event_id=n.event_id AND ec.admin_id=n.admin_id
      WHERE n.admin_id=$1 ORDER BY n.id DESC LIMIT 30`,[req.admin.id]),
      db.one('SELECT COUNT(*)::int c FROM notifications WHERE admin_id=$1 AND read_at IS NULL',[req.admin.id])]);
    res.json({unread:u.c,items});
  }));
  app.post('/api/notifications/read-all',requireAuth,ah(async(req,res)=>{
    await db.run('UPDATE notifications SET read_at=now() WHERE admin_id=$1 AND read_at IS NULL',[req.admin.id]); res.json({ok:true}); }));
};
