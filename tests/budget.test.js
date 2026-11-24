import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthStart, monthSummary, jarBalance, planForNewMonth, suggestions, formatMoney, prevMonth, nextMonth } from '../js/budget.js';

const E = (date, kind, amount, extra = {}) => ({ id: `${date}${kind}${amount}`, date, kind, amount, ...extra });
const entries = [
  E('2026-11-01', 'income', 45000, { source: 'Зарплата' }),
  E('2026-11-03', 'expense', 3200, { target: 'Продукты' }),
  E('2026-11-10', 'expense', 1800, { target: 'продукты' }),
  E('2026-11-12', 'expense', 900, { target: 'Кафе' }),
  E('2026-11-15', 'save', 8000, { jar_id: 'j1' }),
  E('2026-11-20', 'withdraw', 1000, { jar_id: 'j1' }),
  E('2026-10-28', 'expense', 5000, { target: 'Продукты' }),
  E('2026-10-05', 'save', 5000, { jar_id: 'j1' }),
];
const plans = [
  { month: '2026-11-01', category: 'Продукты', kind: 'expense', planned: 10000 },
  { month: '2026-11-01', category: 'Отпуск', kind: 'save', planned: 8000 },
];

test('monthStart / prevMonth', () => {
  assert.equal(monthStart('2026-11-24'), '2026-11-01');
  assert.equal(prevMonth('2026-01-01'), '2025-12-01');
});

test('monthSummary: пришло, потрачено, отложено, осталось — только за месяц', () => {
  const s = monthSummary(entries, plans, '2026-11-01');
  assert.equal(s.income, 45000);
  assert.equal(s.expense, 5900);
  assert.equal(s.saved, 7000); // 8000 в копилку − 1000 из копилки
  assert.equal(s.left, 32100);
  assert.equal(s.plannedExpense, 10000);
});

test('monthSummary: категории без учёта регистра, план и факт', () => {
  const s = monthSummary(entries, plans, '2026-11-01');
  const food = s.rows.find((r) => r.category === 'Продукты');
  assert.deepEqual({ planned: food.planned, spent: food.spent, left: food.left }, { planned: 10000, spent: 5000, left: 5000 });
  const cafe = s.rows.find((r) => r.category === 'Кафе');
  assert.equal(cafe.planned, 0);
  assert.equal(cafe.spent, 900);
  assert.deepEqual(s.sources, [{ name: 'Зарплата', sum: 45000 }]);
});

test('jarBalance: копилка копится через месяцы', () => {
  assert.equal(jarBalance({ id: 'j1' }, entries), 12000);
});

test('planForNewMonth: копирует категории и суммы, id стабильные', () => {
  const a = planForNewMonth(plans, '2026-12-01');
  const b = planForNewMonth(plans, '2026-12-01');
  assert.equal(a.length, 2);
  assert.deepEqual(a.map((p) => [p.month, p.category, p.planned]), [['2026-12-01', 'Продукты', 10000], ['2026-12-01', 'Отпуск', 8000]]);
  assert.equal(a[0].id, b[0].id);
  assert.notEqual(a[0].id, planForNewMonth(plans, '2027-01-01')[0].id);
});

test('suggestions: частые названия первыми, без повторов по регистру', () => {
  assert.deepEqual(suggestions(entries, 'target'), ['Продукты', 'Кафе']);
});

test('formatMoney: рубли с пробелами', () => {
  assert.match(formatMoney(45000), /^45\s000\s₽$/);
  assert.match(formatMoney(1234.5), /^1\s234,5\s₽$/);
});

test('fix I2: копейки без хвостов — нет «−0 ₽» и ложного перерасхода', () => {
  const es = [E('2026-11-01', 'income', 0.3), E('2026-11-02', 'expense', 0.1, { target: 'А' }), E('2026-11-03', 'expense', 0.2, { target: 'А' })];
  const s = monthSummary(es, [{ month: '2026-11-01', category: 'А', kind: 'expense', planned: 0.3 }], '2026-11-01');
  assert.equal(s.left, 0);
  assert.equal(s.rows[0].left, 0);
  assert.doesNotMatch(formatMoney(-0), /[−-]/);
  assert.equal(jarBalance({ id: 'j' }, [E('2026-11-01', 'save', 0.1, { jar_id: 'j' }), E('2026-11-02', 'save', 0.2, { jar_id: 'j' })]), 0.3);
});

test('fix C2: шаг месяца для привычек', () => {
  assert.equal(nextMonth('2026-12-01'), '2027-01-01');
  assert.equal(prevMonth(prevMonth('2026-11-01')), '2026-09-01');
});
