import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb, asUser, insertTask, A } from './harness.js';

async function setup() {
  const db = await makeDb();
  await db.query(`insert into settings (user_id, tz) values ($1, 'Europe/Moscow')`, [A]);
  const t = await insertTask(db, { user_id: A, title: 'Йога', date: '2026-11-23', time: '09:00', remind_minutes: 15 });
  return { db, t };
}
const due = async (db, now) => (await db.query(`select task_id, title, time, remind_minutes from due_reminders($1)`, [now])).rows;

test('напоминание за 15 минут: в 08:45 есть', async () => {
  const { db, t } = await setup();
  assert.deepEqual(await due(db, '2026-11-23 08:45+03'), [{ task_id: t.id, title: 'Йога', time: '09:00:00', remind_minutes: 15 }]);
});

test('в 08:44 ещё рано', async () => {
  const { db } = await setup();
  assert.deepEqual(await due(db, '2026-11-23 08:44+03'), []);
});

test('в 10:30 уже поздно (старше часа)', async () => {
  const { db } = await setup();
  assert.deepEqual(await due(db, '2026-11-23 10:30+03'), []);
});

test('выполненная и без напоминания не попадают', async () => {
  const { db, t } = await setup();
  await insertTask(db, { user_id: A, title: 'Без', date: '2026-11-23', time: '09:00', remind_minutes: null });
  await db.query(`update tasks set done = true where id = $1`, [t.id]);
  assert.deepEqual(await due(db, '2026-11-23 08:50+03'), []);
});

test('после mark_reminded и переноса на следующий день напоминания нет', async () => {
  const { db, t } = await setup();
  await db.query(`select mark_reminded(array[$1]::uuid[])`, [t.id]);
  assert.deepEqual(await due(db, '2026-11-23 08:50+03'), []);
  await db.query(`select run_daily('2026-11-24 00:10+03')`);
  const moved = (await db.query(`select date::text as d from tasks where id = $1`, [t.id])).rows[0].d;
  assert.equal(moved, '2026-11-24');
  assert.deepEqual(await due(db, '2026-11-24 08:50+03'), []);
});

test('браузер не может вызвать due_reminders', async () => {
  const { db } = await setup();
  await assert.rejects(asUser(db, A, (d) => d.query(`select * from due_reminders(now())`)), /permission denied/);
});
