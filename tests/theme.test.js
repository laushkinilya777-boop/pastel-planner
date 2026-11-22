import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, normalizeTheme } from '../js/theme.js';

test('три темы: opal, peach, mint', () => {
  assert.deepEqual(THEMES.map((t) => t.id), ['opal', 'peach', 'mint']);
});

test('normalizeTheme: неизвестная или пустая -> opal', () => {
  assert.equal(normalizeTheme('peach'), 'peach');
  assert.equal(normalizeTheme('dark'), 'opal');
  assert.equal(normalizeTheme(null), 'opal');
});
