import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTER, starterId, starterRow } from '../js/starter.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test('starterId: стабильный UUID для одной картинки, разный для разных', () => {
  assert.match(starterId('photo-1692545219507-f37e87360f5f'), UUID);
  assert.equal(starterId('a'), starterId('a'));
  assert.notEqual(starterId('a'), starterId('b'));
});

test('стартовый набор: 31 фото и 15 фраз, есть весёлые и грустные', () => {
  const photos = STARTER.filter((s) => s.kind === 'link');
  const quotes = STARTER.filter((s) => s.kind === 'quote');
  assert.equal(photos.length, 31);
  assert.equal(quotes.length, 15);
  assert.equal(photos.filter((p) => p.mood === 'sad').length, 8);
  assert.ok(photos.filter((p) => p.mood === 'happy').length >= 5);
  assert.ok(quotes.some((q) => q.mood === 'sad') && quotes.some((q) => q.mood === 'happy'));
  assert.deepEqual([...new Set(photos.map((p) => p.category))].sort(), ['cats', 'dogs']);
  assert.ok(photos.every((p) => p.url.startsWith('https://images.unsplash.com/photo-')));
  assert.equal(new Set(STARTER.map((s) => starterId(s.key))).size, STARTER.length);
});

test('starterRow: строка для таблицы images', () => {
  const row = starterRow(STARTER[0]);
  assert.match(row.id, UUID);
  assert.equal(row.kind, 'link');
  assert.ok(row.url.includes('w=1080'));
  assert.ok('mood' in row);
});
