import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDue, streak, weekStates, monthStates, todayHabits } from '../js/habits.js';

const daily = { id: 'h1', weekdays: null };
const mwf = { id: 'h2', weekdays: [1, 3, 5] }; // пн, ср, пт
const logs = (id, dates) => dates.map((date) => ({ habit_id: id, date }));

test('isDue: каждый день или по выбранным дням', () => {
  assert.equal(isDue(daily, '2026-11-24'), true);
  assert.equal(isDue(mwf, '2026-11-23'), true); // пн
  assert.equal(isDue(mwf, '2026-11-24'), false); // вт
});

test('streak: подряд до вчера, сегодня ещё не ломает', () => {
  const l = logs('h1', ['2026-11-21', '2026-11-22', '2026-11-23']);
  assert.equal(streak(daily, l, '2026-11-24'), 3);
  assert.equal(streak(daily, [...l, ...logs('h1', ['2026-11-24'])], '2026-11-24'), 4);
});

test('streak: пропуск рвёт серию', () => {
  assert.equal(streak(daily, logs('h1', ['2026-11-20', '2026-11-22', '2026-11-23']), '2026-11-24'), 2);
  assert.equal(streak(daily, logs('h1', ['2026-11-20']), '2026-11-24'), 0);
});

test('streak: невыбранные дни не рвут и не считаются', () => {
  // пн 16, ср 18, пт 20, пн 23 — серия 4, вт/чт/выходные пропущены законно
  assert.equal(streak(mwf, logs('h2', ['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-23']), '2026-11-24'), 4);
});

test('weekStates: done / missed / todo / off', () => {
  const st = weekStates(mwf, logs('h2', ['2026-11-23']), '2026-11-23', '2026-11-25');
  // пн done, вт off, ср todo (сегодня), чт off, пт todo, сб off, вс off
  assert.deepEqual(st, ['done', 'off', 'todo', 'off', 'todo', 'off', 'off']);
  const st2 = weekStates(daily, [], '2026-11-23', '2026-11-25');
  assert.deepEqual(st2.slice(0, 3), ['missed', 'missed', 'todo']);
});

test('monthStates: только дни месяца', () => {
  const m = monthStates(daily, logs('h1', ['2026-11-01']), 2026, 11, '2026-11-03');
  assert.equal(m.length, 30);
  assert.deepEqual(m.slice(0, 4).map((x) => x.state), ['done', 'missed', 'todo', 'todo']);
});

test('todayHabits: запланированные на сегодня, без архивных', () => {
  const hs = [daily, mwf, { id: 'h3', weekdays: null, archived: true }];
  assert.deepEqual(todayHabits(hs, '2026-11-24').map((h) => h.id), ['h1']);
});
