import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../js/router.js';
import { isValidEmail, normalizeCode } from '../js/auth-utils.js';

test('parseRoute: пусто и неизвестное -> today', () => {
  assert.deepEqual(parseRoute(''), { name: 'today', params: {} });
  assert.deepEqual(parseRoute('#/'), { name: 'today', params: {} });
  assert.deepEqual(parseRoute('#/котики'), { name: 'today', params: {} });
});

test('parseRoute: разделы', () => {
  assert.deepEqual(parseRoute('#/week'), { name: 'week', params: {} });
  assert.deepEqual(parseRoute('#/month'), { name: 'month', params: {} });
  assert.deepEqual(parseRoute('#/images'), { name: 'images', params: {} });
});

test('parseRoute: день по дате, плохая дата -> today', () => {
  assert.deepEqual(parseRoute('#/day/2026-11-25'), { name: 'day', params: { date: '2026-11-25' } });
  assert.deepEqual(parseRoute('#/day/25.11'), { name: 'today', params: {} });
});

test('isValidEmail', () => {
  assert.equal(isValidEmail(' kitty@mail.ru '), true);
  assert.equal(isValidEmail('kitty@'), false);
  assert.equal(isValidEmail(''), false);
});

test('normalizeCode: убирает пробелы и не-цифры, ровно 6 цифр', () => {
  assert.equal(normalizeCode(' 123 456 '), '123456');
  assert.equal(normalizeCode('12-34-56'), '123456');
  assert.equal(normalizeCode('12345'), null);
});
