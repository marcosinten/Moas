const countries = require('../../public/countries');
const { clean } = require('./validate');

const key = name => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const aliases = new Map(countries.map(name => [key(name), name]));
aliases.set('brazil', 'Brasil');
aliases.set('spain', 'España');
aliases.set('dominican republic', 'República Dominicana');

function country(value) {
  const name = clean(value, 40);
  if (!name || /^(otros?|other)$/i.test(name)) return null;
  return aliases.get(key(name)) || name;
}

module.exports = country;
