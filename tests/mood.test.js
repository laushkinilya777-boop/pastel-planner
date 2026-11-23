import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayMood, pickMoodImage, cheerText } from '../js/mood.js';

const today = '2026-11-23';
const at = (h) => new Date(2026, 10, 23, h, 0);

test('dayMood: всё выполнено — весёлая', () => {
  assert.equal(dayMood([{ date: today, done: true }, { date: today, done: true }], today, at(12)), 'happy');
});

test('dayMood: вечер и остались задачи — грустная', () => {
  assert.equal(dayMood([{ date: today, done: true }, { date: today, done: false }], today, at(20)), 'sad');
  assert.equal(dayMood([{ date: today, done: false }], today, at(19)), null);
});

test('dayMood: есть перенесённая и невыполненная — грустная', () => {
  assert.equal(dayMood([{ date: today, done: false, carry_count: 1 }], today, at(9)), 'sad');
  assert.equal(dayMood([{ date: today, done: true, carry_count: 1 }], today, at(9)), 'happy');
});

test('dayMood: пустой день или чужие даты — обычная', () => {
  assert.equal(dayMood([], today, at(21)), null);
  assert.equal(dayMood([{ date: '2026-11-24', done: false }], today, at(21)), null);
});

test('pickMoodImage: берёт картинки нужного настроения, иначе любые', () => {
  const imgs = [{ id: 'a', mood: 'happy' }, { id: 'b', mood: 'sad' }, { id: 'c', mood: null }];
  assert.equal(pickMoodImage(imgs, 'happy', today).id, 'a');
  assert.equal(pickMoodImage(imgs, 'sad', today).id, 'b');
  assert.ok(['a', 'b', 'c'].includes(pickMoodImage(imgs, null, today).id));
  assert.ok(pickMoodImage([{ id: 'c', mood: null }], 'happy', today));
  assert.equal(pickMoodImage([], 'happy', today), null);
});

test('pickMoodImage: весёлый день никогда не берёт грустную, грустный — весёлую', () => {
  const imgs = [{ id: 'a', mood: 'sad' }, { id: 'b', mood: 'sad' }];
  assert.equal(pickMoodImage(imgs, 'happy', today), null);
  assert.equal(pickMoodImage([{ id: 'h', mood: 'happy' }], 'sad', today), null);
  const mixed = [{ id: 'a', mood: 'sad' }, { id: 'n', mood: null }];
  for (let i = 0; i < 5; i++) assert.equal(pickMoodImage(mixed, 'happy', today, i).id, 'n');
});

test('pickMoodImage: обычный день не показывает грустные, если есть другие', () => {
  const imgs = [{ id: 'a', mood: 'sad' }, { id: 'b', mood: null }, { id: 'c', mood: 'happy' }];
  for (let i = 0; i < 6; i++) assert.notEqual(pickMoodImage(imgs, null, today, i).id, 'a');
});

test('cheerText: похвала с правильными окончаниями', () => {
  assert.equal(cheerText({ done: 3, total: 3 }), 'Всё сделано! Ты умница');
  assert.equal(cheerText({ done: 2, total: 3 }), 'Молодец! Осталась 1 задача');
  assert.equal(cheerText({ done: 1, total: 4 }), 'Молодец! Осталось 3 задачи');
  assert.equal(cheerText({ done: 1, total: 6 }), 'Молодец! Осталось 5 задач');
});
