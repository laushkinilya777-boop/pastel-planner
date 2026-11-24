import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitWithin, pickImageForDate, quoteGradient, isImageUrl, allCategories, categoryName } from '../js/images.js';

test('fitWithin: уменьшает фото с iPhone до 1600 по длинной стороне', () => {
  assert.deepEqual(fitWithin(4032, 3024), { w: 1600, h: 1200 });
  assert.deepEqual(fitWithin(3024, 4032), { w: 1200, h: 1600 });
});

test('fitWithin: маленькие не увеличивает', () => {
  assert.deepEqual(fitWithin(800, 600), { w: 800, h: 600 });
});

test('pickImageForDate: стабильно в течение дня, «другая» даёт другую', () => {
  const imgs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const a = pickImageForDate(imgs, '2026-11-23');
  assert.equal(pickImageForDate(imgs, '2026-11-23').id, a.id);
  assert.notEqual(pickImageForDate(imgs, '2026-11-23', 1).id, a.id);
  assert.equal(pickImageForDate([], '2026-11-23'), null);
});

test('pickImageForDate: порядок списка не меняет выбор', () => {
  const imgs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  assert.equal(pickImageForDate(imgs, '2026-12-01').id, pickImageForDate([...imgs].reverse(), '2026-12-01').id);
});

test('quoteGradient: одна и та же фраза — один и тот же градиент', () => {
  assert.equal(quoteGradient('Ты справишься'), quoteGradient('Ты справишься'));
  assert.match(quoteGradient('Ты справишься'), /^linear-gradient/);
});

test('isImageUrl: только https-ссылки', () => {
  assert.equal(isImageUrl('https://i.pinimg.com/736x/aa/bb/cat.jpg'), true);
  assert.equal(isImageUrl('http://example.com/cat.jpg'), false);
  assert.equal(isImageUrl('javascript:alert(1)'), false);
  assert.equal(isImageUrl('котик'), false);
});

test('allCategories: стандартные + свои по порядку, «Мои» в конце', () => {
  const custom = [{ id: 'c2', name: 'Аниме', sort: 2 }, { id: 'c1', name: 'Цветы', sort: 1 }];
  assert.deepEqual(allCategories(custom).map((c) => c.name), ['Котики', 'Собачки', 'Мотивация', 'Цветы', 'Аниме', 'Мои']);
  assert.equal(categoryName('c2', custom), 'Аниме');
  assert.equal(categoryName('dogs', custom), 'Собачки');
  assert.equal(categoryName('удалённая', custom), 'Мои');
});
