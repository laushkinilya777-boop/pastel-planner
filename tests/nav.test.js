import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAV_ITEMS, MAIN_ON_PHONE } from '../js/nav-items.js';

test('меню: 7 разделов, картинки последние', () => {
  assert.deepEqual(NAV_ITEMS.map((i) => i.name), ['today', 'week', 'month', 'habits', 'budget', 'ideas', 'images']);
});

test('на телефоне в нижней панели 4 раздела, остальное в «Ещё»', () => {
  assert.deepEqual(MAIN_ON_PHONE, ['today', 'week', 'month', 'habits']);
});
