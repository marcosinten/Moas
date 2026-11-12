// Limpieza de datos: texto UTF-8 (tildes y n permitidas en nombres), sin caracteres de control. Usuarios: ASCII estricto.
const clean=(s,max=100)=>{ if(typeof s!=='string') return null;
  const t=s.normalize('NFC').replace(/[\u0000-\u001F\u007F]/g,'').replace(/\s+/g,' ').trim(); return t&&t.length<=max?t:null; };
const username=s=>{ const t=typeof s==='string'?s.trim().toLowerCase():''; return /^[a-z0-9._-]{3,30}$/.test(t)?t:null; };
const password=s=>typeof s==='string'&&s.length>=8&&s.length<=128?s:null;
const isoDate=s=>{ if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; const d=new Date(s+'T00:00:00Z'); return !isNaN(d)&&d.toISOString().slice(0,10)===s?s:null; }; // rechaza 30 de febrero
const hhmm=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s)?s:null;
const votes=n=>Number.isInteger(n)&&n>=0&&n<=100000?n:null; // nunca negativos
const idList=a=>{ if(!Array.isArray(a)||!a.length||a.length>500) return null; const s=[...new Set(a.map(Number))]; return s.every(n=>Number.isInteger(n)&&n>0&&n<=2147483647)?s:null; }; // seleccion multiple
const id=s=>{ const n=Number(s); return Number.isInteger(n)&&n>0&&n<=2147483647?n:null; }; // id de la URL (evita errores de Postgres con valores raros)
module.exports={id,clean,username,password,isoDate,hhmm,votes,idList};
