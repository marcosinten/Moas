const crypto=require('crypto'),db=require('../../core/db'),cfg=require('../../core/config'),{ah}=require('../../core/http');
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const hashPassword=pw=>{const s=crypto.randomBytes(16);return `scrypt$${s.toString('hex')}$${crypto.scryptSync(pw,s,64).toString('hex')}`;};
const verifyPassword=(pw,st)=>{const [a,s,h]=String(st).split('$'); if(a!=='scrypt'||!s||!h) return false;
  const d=crypto.scryptSync(pw,Buffer.from(s,'hex'),64),e=Buffer.from(h,'hex'); return d.length===e.length&&crypto.timingSafeEqual(d,e);};
const DUMMY=hashPassword('dummy-password');
const createSession=async id=>{const t=crypto.randomBytes(32).toString('base64url');
  await db.run('INSERT INTO sessions(id,admin_id,expires_at) VALUES($1,$2,$3)',[sha(t),id,new Date(Date.now()+cfg.sessionHours*36e5)]); return t;};
const readCookie=(req,n)=>{const m=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(n+'=')); return m?decodeURIComponent(m.slice(n.length+1)):null;};
const COOKIE=t=>`sid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${cfg.sessionHours*3600}${cfg.prod?'; Secure':''}`;
const requireAuth=ah(async(req,res,next)=>{ const t=readCookie(req,'sid');
  const r=t&&await db.one(`SELECT a.id,a.username,a.display_name,a.role,a.must_change_password FROM sessions s JOIN admins a ON a.id=s.admin_id
    WHERE s.id=$1 AND s.expires_at>now() AND a.active=1`,[sha(t)]);
  if(!r) return res.status(401).json({error:'No autenticada'}); req.admin=r; next(); });
const requireRole=role=>(req,res,next)=>req.admin.role===role?next():res.status(403).json({error:'Sin permiso'});
const tries=new Map(); // limitador simple: 5 fallos por 15 min por IP+usuario
const blocked=k=>{const e=tries.get(k); return e&&e.n>=5&&e.until>Date.now();};
const fail=k=>{const e=tries.get(k)||{n:0}; e.n++; e.until=Date.now()+15*60e3; tries.set(k,e);};
module.exports={hashPassword,verifyPassword,DUMMY,createSession,readCookie,COOKIE,sha,requireAuth,requireRole,blocked,fail,tries};
