import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalProgress, goalsFor } from '../js/goals.js';
import { specialDatesForMonth } from '../js/special-dates.js';

const g = { id: 'g1', target: 2, manual_adjust: 1, period: 'week', period_start: '2026-11-23' };

test('goalProgress: привязанные выполненные + ручная поправка', () => {
  const tasks = [
    { goal_id: 'g1', done: true },
    { goal_id: 'g1', done: false },
    { goal_id: 'other', done: true },
  ];
  assert.deepEqual(goalProgress(g, tasks), { value: 2, target: 2, percent: 100 });
});

test('goalProgress: не уходит ниже 0 и выше цели', () => {
  assert.deepEqual(goalProgress({ ...g, manual_adjust: -5 }, []), { value: 0, target: 2, percent: 0 });
  assert.deepEqual(goalProgress({ ...g, manual_adjust: 9 }, []), { value: 2, target: 2, percent: 100 });
});

test('goalProgress: невыполненная не считается', () => {
  assert.deepEqual(goalProgress({ ...g, manual_adjust: 0, target: 4 }, [{ goal_id: 'g1', done: false }]), { value: 0, target: 4, percent: 0 });
  assert.deepEqual(goalProgress({ ...g, manual_adjust: 0, target: 3 }, [{ goal_id: 'g1', done: true }]), { value: 1, target: 3, percent: 33 });
});

test('goalsFor: по периоду и началу периода', () => {
  const goals = [g, { ...g, id: 'g2', period: 'month', period_start: '2026-11-01' }, { ...g, id: 'g3', period_start: '2026-11-16' }];
  assert.deepEqual(goalsFor(goals, 'week', '2026-11-23').map((x) => x.id), ['g1']);
  assert.deepEqual(goalsFor(goals, 'month', '2026-11-01').map((x) => x.id), ['g2']);
});

test('specialDatesForMonth: ежегодный день рождения переносится в нужный год', () => {
  const m = specialDatesForMonth([{ id: 'b', date: '2000-03-15', title: 'ДР мамы', yearly: true }], 2027, 3);
  assert.deepEqual([...m.keys()], ['2027-03-15']);
});

test('specialDatesForMonth: 29 февраля -> 28 в невисокосный год', () => {
  const m = specialDatesForMonth([{ id: 'l', date: '2028-02-29', title: 'Високосный', yearly: true }], 2029, 2);
  assert.deepEqual([...m.keys()], ['2029-02-28']);
});

test('specialDatesForMonth: разовая дата из другого года не показывается, свои — группируются', () => {
  const m = specialDatesForMonth([
    { id: 'a', date: '2025-11-10', title: 'старый дедлайн', yearly: false },
    { id: 'b', date: '2026-11-10', title: 'дедлайн', yearly: false },
    { id: 'c', date: '2026-11-10', title: 'праздник', yearly: false },
  ], 2026, 11);
  assert.deepEqual([...m.keys()], ['2026-11-10']);
  assert.deepEqual(m.get('2026-11-10').map((x) => x.id), ['b', 'c']);
});

test('specialDatesForMonth: ежегодная дата до года начала не показывается', () => {
  const m = specialDatesForMonth([{ id: 'w', date: '2027-06-01', title: 'годовщина', yearly: true }], 2026, 6);
  assert.equal(m.size, 0);
});
