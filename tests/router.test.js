import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../js/router.js';
import { isValidEmail, passwordProblem, needsPassword, linkErrorMessage } from '../js/auth-utils.js';

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

test('passwordProblem: минимум 8 символов и совпадение', () => {
  assert.equal(passwordProblem('kitty123', 'kitty123'), null);
  assert.equal(passwordProblem('kit', 'kit'), 'Пароль должен быть не короче 8 символов');
  assert.equal(passwordProblem('kitty123', 'kitty124'), 'Пароли не совпадают');
  assert.equal(passwordProblem('        ', '        '), 'Пароль не может состоять из одних пробелов');
});

test('needsPassword: после входа по ссылке без пароля', () => {
  assert.equal(needsPassword({ user_metadata: {} }), true);
  assert.equal(needsPassword({ user_metadata: { has_password: true } }), false);
  assert.equal(needsPassword(null), false);
});

test('linkErrorMessage: лимит писем Supabase — про час, а не про минуту', () => {
  assert.match(linkErrorMessage('email rate limit exceeded'), /час/);
  assert.match(linkErrorMessage('For security purposes, you can only request this after 42 seconds.'), /42 сек/);
  assert.match(linkErrorMessage('Signups not allowed for otp'), /только для хозяйки/);
  assert.match(linkErrorMessage('Failed to fetch'), /интернет/);
});

test('parseRoute: новые разделы', () => {
  for (const n of ['habits', 'budget', 'ideas']) assert.deepEqual(parseRoute(`#/${n}`), { name: n, params: {} });
});
