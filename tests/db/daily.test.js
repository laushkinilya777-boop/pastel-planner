import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb, asUser, insertTask, A, B } from './harness.js';

async function setup() {
  const db = await makeDb();
  await db.query(`insert into settings (user_id, tz) values ($1, 'Europe/Moscow')`, [A]);
  return db;
}
const get = async (db, id) => (await db.query(`select date::text as date, carry_count from tasks where id = $1`, [id])).rows[0];

test('перенос за 3 дня: дата сегодня, carry_count = 3, одна строка истории', async () => {
  const db = await setup();
  const t = await insertTask(db, { user_id: A, title: 'Отчёт', date: '2026-11-20' });
  await db.query(`select run_daily('2026-11-23 00:10+03')`);
  assert.deepEqual(await get(db, t.id), { date: '2026-11-23', carry_count: 3 });
  const h = (await db.query(`select field, old_value, new_value from task_history where task_id = $1`, [t.id])).rows;
  assert.deepEqual(h, [{ field: 'date', old_value: '2026-11-20', new_value: '2026-11-23' }]);
});

test('выполненная не переносится', async () => {
  const db = await setup();
  const t = await insertTask(db, { user_id: A, title: 'Готово', date: '2026-11-22', done: true });
  await db.query(`select run_daily('2026-11-23 09:00+03')`);
  assert.equal((await get(db, t.id)).date, '2026-11-22');
});

test('повторяющаяся не переносится', async () => {
  const db = await setup();
  const r = (await db.query(`insert into recurrences (user_id, title, freq, start_date, materialized_until)
    values ($1, 'Витамины', 'daily', '2026-11-22', '2026-11-22') returning id`, [A])).rows[0];
  const t = await insertTask(db, { user_id: A, title: 'Витамины', date: '2026-11-22', recurrence_id: r.id, occurrence_date: '2026-11-22' });
  await db.query(`select run_daily('2026-11-23 09:00+03')`);
  assert.equal((await get(db, t.id)).date, '2026-11-22');
});

test('до 00:05 по местному времени не переносится', async () => {
  const db = await setup();
  const t = await insertTask(db, { user_id: A, title: 'Отчёт', date: '2026-11-22' });
  await db.query(`select run_daily('2026-11-23 00:03+03')`);
  assert.equal((await get(db, t.id)).date, '2026-11-22');
});

test('второй вызов в тот же день ничего не делает', async () => {
  const db = await setup();
  const t = await insertTask(db, { user_id: A, title: 'Отчёт', date: '2026-11-22' });
  await db.query(`select run_daily('2026-11-23 00:10+03')`);
  // задачу вернули на вчера вручную — второй запуск за день её не трогает
  await db.query(`update tasks set date = '2026-11-22' where id = $1`, [t.id]);
  await db.query(`select run_daily('2026-11-23 15:00+03')`);
  assert.equal((await get(db, t.id)).date, '2026-11-22');
  const last = (await db.query(`select last_rollover_date::text as d from settings where user_id = $1`, [A])).rows[0].d;
  assert.equal(last, '2026-11-23');
});

test('run_daily досоздаёт повторы до today + 60', async () => {
  const db = await setup();
  const r = (await db.query(`insert into recurrences (user_id, title, freq, start_date)
    values ($1, 'Витамины', 'daily', '2026-11-23') returning id`, [A])).rows[0];
  await db.query(`select run_daily('2026-11-23 08:00+03')`);
  const m = (await db.query(`select max(date)::text as m, count(*)::int as n from tasks where recurrence_id = $1`, [r.id])).rows[0];
  assert.deepEqual(m, { m: '2027-01-22', n: 61 });
});

test('run_daily из браузера трогает только свои задачи', async () => {
  const db = await setup();
  await db.query(`insert into settings (user_id) values ($1)`, [B]);
  const ta = await insertTask(db, { user_id: A, title: 'A', date: '2026-11-20' });
  const tb = await insertTask(db, { user_id: B, title: 'B', date: '2026-11-20' });
  await asUser(db, B, (d) => d.query(`select run_daily('2026-11-23 10:00+03')`));
  assert.equal((await get(db, ta.id)).date, '2026-11-20');
  assert.equal((await get(db, tb.id)).date, '2026-11-23');
});
