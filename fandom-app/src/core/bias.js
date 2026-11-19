const labels = Object.freeze({soobin:'Soobin',yeonjun:'Yeonjun',beomgyu:'Beomgyu',taehyun:'Taehyun',kai:'Huening Kai',ot5:'OT5'});
const normalize = raw => {
  if (raw === '' || raw === null || raw === undefined) return null;
  return typeof raw === 'string' && Object.hasOwn(labels,raw) ? raw : undefined;
};
module.exports = {labels,normalize};
