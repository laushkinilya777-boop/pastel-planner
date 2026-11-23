// Красные даты и дедлайны месяца. Ежегодные (дни рождения) переносятся в показываемый год.
const pad = (n) => String(n).padStart(2, '0');
const lastDay = (y, m) => new Date(y, m, 0).getDate();

export function specialDatesForMonth(dates, year, month) {
  const map = new Map();
  const add = (iso, row) => { if (!map.has(iso)) map.set(iso, []); map.get(iso).push(row); };
  for (const d of dates) {
    const [y, m, day] = d.date.split('-').map(Number);
    if (d.yearly) {
      if (m !== month || y > year) continue;
      add(`${year}-${pad(month)}-${pad(Math.min(day, lastDay(year, month)))}`, d);
    } else if (y === year && m === month) {
      add(d.date, d);
    }
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
