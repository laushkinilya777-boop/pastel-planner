import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushAvailability, urlBase64ToUint8Array } from '../js/push-utils.js';
import { buildPayload } from '../supabase/functions/reminders/payload.js';

test('pushAvailability: iPhone в Safari — сначала на экран «Домой»', () => {
  assert.equal(pushAvailability({ hasSW: true, hasPush: false, isStandalone: false, isIOS: true }), 'need-home-screen');
  assert.equal(pushAvailability({ hasSW: true, hasPush: true, isStandalone: false, isIOS: true }), 'need-home-screen');
});

test('pushAvailability: iPhone с экрана «Домой» — можно', () => {
  assert.equal(pushAvailability({ hasSW: true, hasPush: true, isStandalone: true, isIOS: true }), 'ok');
});

test('pushAvailability: компьютер', () => {
  assert.equal(pushAvailability({ hasSW: true, hasPush: true, isStandalone: false, isIOS: false }), 'ok');
  assert.equal(pushAvailability({ hasSW: false, hasPush: false, isStandalone: false, isIOS: false }), 'unsupported');
});

test('urlBase64ToUint8Array: публичный VAPID-ключ в байты', () => {
  const bytes = urlBase64ToUint8Array('BAEC');
  assert.deepEqual([...bytes], [4, 1, 2]);
});

test('buildPayload: текст напоминания', () => {
  assert.deepEqual(buildPayload({ title: 'Йога', time: '09:00:00', remind_minutes: 15 }), {
    title: 'Йога',
    body: 'в 09:00 · через 15 мин',
    url: './#/today',
    tag: undefined,
  });
  assert.equal(buildPayload({ task_id: 't1', title: 'Йога', time: '09:00:00', remind_minutes: 15 }).tag, 'task-t1');
});
