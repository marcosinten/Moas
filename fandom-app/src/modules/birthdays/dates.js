const timeZone = 'America/Guayaquil';
const calendarDays = 30;
const dayMs = 86400000;
const guayaquilDate = new Intl.DateTimeFormat('en', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
});

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function birthdayWindow(now = new Date()) {
  const parts = Object.fromEntries(guayaquilDate.formatToParts(now).map(part => [part.type, part.value]));
  const today = parts.year + '-' + parts.month + '-' + parts.day;
  const through = isoDate(new Date(Date.parse(today) + calendarDays * dayMs));
  return { today, through, days: calendarDays };
}

function birthdayOccurrence(birthDate, year) {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const originalDate = new Date(birthDate + 'T00:00:00Z');
  if (Number.isNaN(originalDate.valueOf()) || isoDate(originalDate) !== birthDate) return null;
  const age = year - Number(birthDate.slice(0, 4));
  if (age <= 0) return null;
  let date = String(year) + birthDate.slice(4);
  if (birthDate.endsWith('-02-29') && isoDate(new Date(date)) !== date) date = year + '-02-28';
  return { date, age };
}

function selectForBirthday(items, date, memberId) {
  if (!items.length) return null;
  const dayNumber = Date.parse(date) / dayMs;
  return items[(dayNumber + memberId) % items.length];
}

module.exports = { birthdayWindow, birthdayOccurrence, selectForBirthday };
