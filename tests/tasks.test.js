import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sortTasks, taskBadges, newTaskDraft, withTimeChange, dayProgress, historyLine, recurrenceRule, describeRule,
} from '../js/tasks.js';

test('sortTasks: со временем по возрастанию, без времени по созданию, выполненные в конце', () => {
  const tasks = [
    { id: 'a', title: 'без времени 2', time: null, created_at: '2026-11-23T10:00:00Z', done: false },
    { id: 'b', title: '15:00', time: '15:00:00', created_at: '2026-11-23T09:00:00Z', done: false },
    { id: 'c', title: 'готово 08:00', time: '08:00:00', created_at: '2026-11-23T08:00:00Z', done: true },
    { id: 'd', title: '09:00', time: '09:00:00', created_at: '2026-11-23T11:00:00Z', done: false },
    { id: 'e', title: 'без времени 1', time: null, created_at: '2026-11-23T07:00:00Z', done: false },
  ];
  assert.deepEqual(sortTasks(tasks).map((t) => t.id), ['d', 'b', 'e', 'a', 'c']);
});

test('taskBadges', () => {
  const today = '2026-11-23';
  assert.deepEqual(taskBadges({ carry_count: 2, occurrence_date: null, date: today }, today), ['carried']);
  assert.deepEqual(taskBadges({ carry_count: 0, occurrence_date: '2026-11-22', recurrence_id: 'r', done: false, date: '2026-11-22' }, today), ['missed', 'repeat']);
  assert.deepEqual(taskBadges({ carry_count: 0, occurrence_date: today, recurrence_id: 'r', done: false, date: today }, today), ['repeat']);
  assert.deepEqual(taskBadges({ carry_count: 0, date: today }, today), []);
});

test('newTaskDraft: напоминание 15 минут только при времени', () => {
  assert.equal(newTaskDraft({ date: '2026-11-23', time: '09:00' }).remind_minutes, 15);
  assert.equal(newTaskDraft({ date: '2026-11-23' }).remind_minutes, null);
  assert.equal(newTaskDraft({ date: '2026-11-23' }).done, false);
});

test('withTimeChange', () => {
  assert.equal(withTimeChange({ time: null, remind_minutes: null }, '10:00').remind_minutes, 15);
  assert.equal(withTimeChange({ time: '09:00', remind_minutes: 30 }, '10:00').remind_minutes, 30);
  assert.deepEqual(withTimeChange({ time: '09:00', remind_minutes: 30 }, ''), { time: null, remind_minutes: null });
});

test('dayProgress', () => {
  assert.deepEqual(dayProgress([{ done: true }, { done: false }, { done: false }, { done: true }]), { done: 2, total: 4, percent: 50 });
  assert.deepEqual(dayProgress([]), { done: 0, total: 0, percent: 0 });
});

test('historyLine: понятная строка истории', () => {
  assert.equal(historyLine({ field: 'date', old_value: '2026-11-22', new_value: '2026-11-23', changed_at: new Date(2026, 10, 23, 21, 10).toISOString() }),
    '23 ноя, 21:10 — дата: 22.11 → 23.11');
  assert.equal(historyLine({ field: 'time', old_value: null, new_value: '09:30:00', changed_at: new Date(2026, 10, 23, 8, 5).toISOString() }),
    '23 ноя, 08:05 — время: нет → 09:30');
  assert.equal(historyLine({ field: 'title', old_value: 'Йога', new_value: 'Йога утром', changed_at: new Date(2026, 10, 2, 7, 0).toISOString() }),
    '2 ноя, 07:00 — название: «Йога» → «Йога утром»');
});

test('recurrenceRule: из формы в строку recurrences', () => {
  assert.deepEqual(recurrenceRule({ repeat: 'weekdays', weekdays: [3, 1], until: '' }, '2026-11-23'),
    { freq: 'weekdays', weekdays: [1, 3], start_date: '2026-11-23', end_date: null });
  assert.deepEqual(recurrenceRule({ repeat: 'daily', weekdays: [], until: '2026-12-31' }, '2026-11-23'),
    { freq: 'daily', weekdays: null, start_date: '2026-11-23', end_date: '2026-12-31' });
  assert.equal(recurrenceRule({ repeat: 'none' }, '2026-11-23'), null);
  assert.equal(recurrenceRule({ repeat: 'weekdays', weekdays: [] }, '2026-11-23'), null);
});

test('describeRule', () => {
  assert.equal(describeRule({ freq: 'daily' }), 'каждый день');
  assert.equal(describeRule({ freq: 'weekdays', weekdays: [1, 3] }), 'по пн, ср');
  assert.equal(describeRule({ freq: 'weekly', start_date: '2026-11-19' }), 'каждый чт');
  assert.equal(describeRule({ freq: 'monthly', start_date: '2026-11-05' }), 'каждый месяц, 5-го');
  assert.equal(describeRule({ freq: 'yearly', start_date: '2026-03-08' }), 'каждый год, 8 марта');
});
