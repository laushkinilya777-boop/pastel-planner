import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUSES, byStatus, shiftStatus, parseTags, ideasForDate, platformLabel } from '../js/ideas.js';

test('статусы по порядку', () => {
  assert.deepEqual(STATUSES.map((s) => s.id), ['idea', 'script', 'shooting', 'published']);
});

test('shiftStatus: вперёд и назад, не выходит за края', () => {
  assert.equal(shiftStatus('idea', 1), 'script');
  assert.equal(shiftStatus('shooting', 1), 'published');
  assert.equal(shiftStatus('published', 1), 'published');
  assert.equal(shiftStatus('idea', -1), 'idea');
});

test('byStatus: группы с сортировкой — с датой раньше, потом новые сверху', () => {
  const ideas = [
    { id: 'a', status: 'idea', created_at: '2026-11-01' },
    { id: 'b', status: 'idea', created_at: '2026-11-05' },
    { id: 'c', status: 'idea', publish_date: '2026-11-30', created_at: '2026-10-01' },
    { id: 'd', status: 'published', created_at: '2026-11-02' },
  ];
  const g = byStatus(ideas);
  assert.deepEqual(g.idea.map((i) => i.id), ['c', 'b', 'a']);
  assert.deepEqual(g.published.map((i) => i.id), ['d']);
  assert.deepEqual(g.script, []);
});

test('parseTags: решётки, запятые и пробелы', () => {
  assert.deepEqual(parseTags('#уход, утро  #GRWM уход'), ['уход', 'утро', 'grwm']);
  assert.deepEqual(parseTags(''), []);
});

test('ideasForDate и platformLabel', () => {
  const ideas = [{ id: 'a', publish_date: '2026-11-24', status: 'shooting' }, { id: 'b', publish_date: '2026-11-25' }];
  assert.deepEqual(ideasForDate(ideas, '2026-11-24').map((i) => i.id), ['a']);
  assert.equal(platformLabel('both'), 'Reels + TikTok');
  assert.equal(platformLabel('tiktok'), 'TikTok');
});
