import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, WEATHER, normalizeTheme, needsDailyPick } from '../js/theme.js';

test('три темы: opal, peach, mint', () => {
  assert.deepEqual(THEMES.map((t) => t.id), ['opal', 'peach', 'mint']);
});

test('погода -> тема: солнце=персик, облака=опал, дождь/снег=мята', () => {
  const map = Object.fromEntries(WEATHER.map((w) => [w.id, w.theme]));
  assert.deepEqual(map, { sunny: 'peach', cloudy: 'opal', rainy: 'mint' });
});

test('needsDailyPick: спрашиваем один раз в день', () => {
  assert.equal(needsDailyPick(null, '2026-11-23'), true);
  assert.equal(needsDailyPick({ date: '2026-11-22', weather: 'sunny' }, '2026-11-23'), true);
  assert.equal(needsDailyPick({ date: '2026-11-23', weather: 'rainy' }, '2026-11-23'), false);
  assert.equal(needsDailyPick({ date: '2026-11-23', weather: 'tornado' }, '2026-11-23'), true);
});

test('normalizeTheme: неизвестная или пустая -> opal', () => {
  assert.equal(normalizeTheme('peach'), 'peach');
  assert.equal(normalizeTheme('dark'), 'opal');
  assert.equal(normalizeTheme(null), 'opal');
});
