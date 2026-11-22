// Все даты дня — строки 'YYYY-MM-DD' в локальном времени.
// toISOString() здесь не используется: он сдвигает дату в UTC.

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO() {
  return toISODate(new Date());
}

// Полдень защищает от сдвигов при переходе на летнее время.
export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(a, b) {
  return Math.round((parseISODate(b) - parseISODate(a)) / 86400000);
}

// ISO день недели: 1 = пн … 7 = вс
export function isoWeekday(iso) {
  return parseISODate(iso).getDay() || 7;
}

export function weekStart(iso) {
  return addDays(iso, 1 - isoWeekday(iso));
}

export function weekDays(iso) {
  const start = weekStart(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthGrid(year, month) {
  const start = weekStart(`${year}-${pad(month)}-01`);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dayFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
const monthFmt = new Intl.DateTimeFormat('ru-RU', { month: 'long' });

export function formatDayTitle(iso) {
  const parts = dayFmt.formatToParts(parseISODate(iso));
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${cap(get('weekday'))}, ${get('day')} ${get('month')}`;
}

export function formatMonthTitle(year, month) {
  return `${cap(monthFmt.format(new Date(year, month - 1, 1, 12)))} ${year}`;
}

export function formatShortDate(iso) {
  const d = parseISODate(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}
