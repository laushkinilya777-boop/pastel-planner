import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toISODate, addDays, weekStart, weekDays, monthGrid, daysBetween,
  formatDayTitle, formatMonthTitle,
} from '../js/dates.js';

test('toISODate: локальная дата сразу после полуночи', () => {
  assert.equal(toISODate(new Date(2026, 10, 23, 0, 30)), '2026-11-23');
  assert.equal(toISODate(new Date(2026, 10, 22, 23, 59)), '2026-11-22');
});

test('weekStart: неделя с понедельника', () => {
  assert.equal(weekStart('2026-11-22'), '2026-11-16');
  assert.equal(weekStart('2026-11-16'), '2026-11-16');
});

test('weekDays: 7 дней с понедельника', () => {
  const d = weekDays('2026-11-19');
  assert.equal(d.length, 7);
  assert.equal(d[0], '2026-11-16');
  assert.equal(d[6], '2026-11-22');
});

test('monthGrid: 42 клетки с понедельника', () => {
  const g = monthGrid(2026, 11);
  assert.equal(g.length, 42);
  assert.equal(g[0], '2026-10-26');
  assert.ok(g.includes('2026-11-30'));
});

test('addDays: переход месяца и високосный год', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});

test('daysBetween', () => {
  assert.equal(daysBetween('2026-11-20', '2026-11-23'), 3);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
});

test('formatDayTitle / formatMonthTitle', () => {
  assert.equal(formatDayTitle('2026-11-23'), 'Понедельник, 23 ноября');
  assert.equal(formatMonthTitle(2026, 11), 'Ноябрь 2026');
});
