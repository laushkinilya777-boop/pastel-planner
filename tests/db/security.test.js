import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb, asAnon, asUser, A, B } from './harness.js';

const calls = {
  rollover_tasks: `select rollover_tasks('${A}', '2026-11-23')`,
  materialize: `select materialize('${A}', '2026-11-23')`,
  run_daily: `select run_daily(now())`,
  due_reminders: `select * from due_reminders(now())`,
  mark_reminded: `select mark_reminded(array[]::uuid[])`,
  split_recurrence: `select split_recurrence(gen_random_uuid(), '{}'::jsonb)`,
  end_recurrence_from: `select end_recurrence_from(gen_random_uuid())`,
};

for (const [name, sql] of Object.entries(calls)) {
  test(`гость без входа не может вызвать ${name}`, async () => {
    const db = await makeDb();
    await assert.rejects(asAnon(db, (d) => d.query(sql)), /permission denied/);
  });
}

test('вошедший пользователь не может вызвать rollover_tasks напрямую', async () => {
  const db = await makeDb();
  await assert.rejects(asUser(db, B, (d) => d.query(calls.rollover_tasks)), /permission denied/);
});

test('materialize для чужого пользователя запрещён', async () => {
  const db = await makeDb();
  await assert.rejects(asUser(db, B, (d) => d.query(calls.materialize)), /другому пользователю/);
});
