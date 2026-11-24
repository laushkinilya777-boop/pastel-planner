// Бюджет: сводка месяца, план и факт по категориям, копилки, перенос плана на новый месяц.
import { stableId } from './ids.js';

const pad = (n) => String(n).padStart(2, '0');
export const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
export function prevMonth(m) {
  const [y, mm] = m.split('-').map(Number);
  return mm === 1 ? `${y - 1}-12-01` : `${y}-${pad(mm - 1)}-01`;
}
export function nextMonth(m) {
  const [y, mm] = m.split('-').map(Number);
  return mm === 12 ? `${y + 1}-01-01` : `${y}-${pad(mm + 1)}-01`;
}

const norm = (s) => String(s || '').trim().toLowerCase();
const num = (v) => Number(v) || 0;
// считаем в копейках (целые числа), чтобы не было хвостов вроде 0,30000000000000004
const kop = (v) => Math.round(num(v) * 100);
const rub = (k) => (k === 0 ? 0 : k / 100);
const inMonth = (e, m) => e.date && e.date.slice(0, 7) === m.slice(0, 7);

export function monthSummary(entries, plans, month) {
  const es = entries.filter((e) => inMonth(e, month));
  const sum = (kind) => es.filter((e) => e.kind === kind).reduce((a, e) => a + kop(e.amount), 0);
  const income = sum('income');
  const expense = sum('expense');
  const saved = sum('save') - sum('withdraw');
  const monthPlans = plans.filter((p) => p.month === month);

  // категории расходов: из плана + встретившиеся в записях
  const rows = new Map();
  for (const p of monthPlans.filter((x) => x.kind !== 'save')) {
    rows.set(norm(p.category), { category: p.category, planned: kop(p.planned), spent: 0, plan: p });
  }
  for (const e of es.filter((x) => x.kind === 'expense')) {
    const k = norm(e.target) || 'без категории';
    if (!rows.has(k)) rows.set(k, { category: e.target?.trim() || 'Без категории', planned: 0, spent: 0, plan: null });
    rows.get(k).spent += kop(e.amount);
  }
  const list = [...rows.values()]
    .map((r) => ({ ...r, planned: rub(r.planned), spent: rub(r.spent), left: rub(r.planned - r.spent) }))
    .sort((a, b) => (b.planned - a.planned) || (b.spent - a.spent));

  const src = new Map();
  for (const e of es.filter((x) => x.kind === 'income')) {
    const k = norm(e.source) || 'без названия';
    if (!src.has(k)) src.set(k, { name: e.source?.trim() || 'Без названия', sum: 0 });
    src.get(k).sum += kop(e.amount);
  }

  const plannedExpense = list.reduce((a, r) => a + r.planned, 0);
  const plannedSave = rub(monthPlans.filter((p) => p.kind === 'save').reduce((a, p) => a + kop(p.planned), 0));
  return {
    income: rub(income), expense: rub(expense), saved: rub(saved),
    left: rub(income - expense - saved),
    plannedExpense, plannedSave,
    rows: list,
    savePlans: monthPlans.filter((p) => p.kind === 'save'),
    sources: [...src.values()].map((x) => ({ ...x, sum: rub(x.sum) })).sort((a, b) => b.sum - a.sum),
  };
}

// Баланс копилки за всё время: вложили − забрали.
export const jarBalance = (jar, entries) => rub(entries
  .filter((e) => e.jar_id === jar.id)
  .reduce((a, e) => a + (e.kind === 'save' ? kop(e.amount) : e.kind === 'withdraw' ? -kop(e.amount) : 0), 0));

// План нового месяца = категории и суммы прошлого; id стабильные — два устройства не задвоят.
export const planForNewMonth = (prevPlans, month) => prevPlans.map((p, i) => ({
  id: stableId(`plan:${month}:${norm(p.category)}`),
  month, category: p.category, kind: p.kind || 'expense', planned: num(p.planned), sort: p.sort ?? i,
}));

export function suggestions(entries, field) {
  const count = new Map();
  for (const e of entries) {
    const v = String(e[field] || '').trim();
    if (!v) continue;
    const k = norm(v);
    const c = count.get(k) || { name: v, n: 0 };
    c.n += 1;
    count.set(k, c);
  }
  return [...count.values()].sort((a, b) => b.n - a.n).map((c) => c.name);
}

const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
export const formatMoney = (n) => `${fmt.format(Math.abs(num(n)) < 0.005 ? 0 : num(n))} ₽`;
