import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb, insertTask, A } from './harness.js';

async function addRec(db, fields) {
  const row = { user_id: A, title: 'Повтор', ...fields };
  const cols = Object.keys(row);
  return (await db.query(
    `insert into recurrences (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) returning *`,
    Object.values(row),
  )).rows[0];
}

async function dates(db, recId, from, to) {
  return (await db.query(
    `select d::text as d from recurrence_dates((select r from recurrences r where id = $1), $2::date, $3::date) d order by d`,
    [recId, from, to],
  )).rows.map((r) => r.d);
}

async function taskDates(db, recId) {
  return (await db.query(`select date::text as d, title from tasks where recurrence_id = $1 order by date`, [recId])).rows;
}

test('weekdays пн, ср', async () => {
  const db = await makeDb();
  const r = await addRec(db, { freq: 'weekdays', weekdays: [1, 3], start_date: '2026-11-16' });
  assert.deepEqual(await dates(db, r.id, '2026-11-16', '2026-11-29'),
    ['2026-11-16', '2026-11-18', '2026-11-23', '2026-11-25']);
});

test('weekly: тот же день недели, что start_date', async () => {
  const db = await makeDb();
  const r = await addRec(db, { freq: 'weekly', start_date: '2026-11-19' }); // четверг
  assert.deepEqual(await dates(db, r.id, '2026-11-01', '2026-12-04'), ['2026-11-19', '2026-11-26', '2026-12-03']);
});

test('monthly с 31-го: последний день короткого месяца', async () => {
  const db = await makeDb();
  const r = await addRec(db, { freq: 'monthly', start_date: '2026-01-31' });
  assert.deepEqual(await dates(db, r.id, '2026-01-01', '2026-04-30'),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
});

test('yearly с 29 февраля: 28 февраля в невисокосный год', async () => {
  const db = await makeDb();
  const r = await addRec(db, { freq: 'yearly', start_date: '2028-02-29' });
  assert.deepEqual(await dates(db, r.id, '2028-01-01', '2030-12-31'),
    ['2028-02-29', '2029-02-28', '2030-02-28']);
});

test('end_date ограничивает и start_date не раньше начала', async () => {
  const db = await makeDb();
  const r = await addRec(db, { freq: 'daily', start_date: '2026-11-20', end_date: '2026-11-22' });
  assert.deepEqual(await dates(db, r.id, '2026-11-01', '2026-12-31'), ['2026-11-20', '2026-11-21', '2026-11-22']);
});

test('materialize создаёт задачи с полями правила и идемпотентен', async () => {
  const db = await makeDb();
  const r = await addRec(db, { title: 'Витамины', time: '08:00', remind_minutes: 15, freq: 'daily', start_date: '2026-11-20' });
  const n1 = (await db.query(`select materialize($1, '2026-11-24') as n`, [A])).rows[0].n;
  assert.equal(n1, 5);
  const n2 = (await db.query(`select materialize($1, '2026-11-24') as n`, [A])).rows[0].n;
  assert.equal(n2, 0);
  const t = (await db.query(`select * from tasks where recurrence_id = $1 order by date limit 1`, [r.id])).rows[0];
  assert.equal(t.title, 'Витамины');
  assert.equal(t.time, '08:00:00');
  assert.equal(t.remind_minutes, 15);
  assert.equal(t.occurrence_date.toISOString().slice(0, 10), '2026-11-20');
  const mu = (await db.query(`select materialized_until::text as m from recurrences where id = $1`, [r.id])).rows[0].m;
  assert.equal(mu, '2026-11-24');
});

test('materialize продолжает с materialized_until + 1', async () => {
  const db = await makeDb();
  const r = await addRec(db, { freq: 'daily', start_date: '2026-11-20' });
  await db.query(`select materialize($1, '2026-11-21')`, [A]);
  const n = (await db.query(`select materialize($1, '2026-11-23') as n`, [A])).rows[0].n;
  assert.equal(n, 2);
  assert.equal((await taskDates(db, r.id)).length, 4);
});

test('split: «эта и все следующие» с середины', async () => {
  const db = await makeDb();
  const r = await addRec(db, { title: 'Йога', freq: 'daily', start_date: '2026-11-20' });
  await db.query(`select materialize($1, '2026-11-30')`, [A]);
  // 26-го задача уже выполнена до изменения
  await db.query(`update tasks set done = true where recurrence_id = $1 and occurrence_date = '2026-11-26'`, [r.id]);
  const t25 = (await db.query(`select id from tasks where recurrence_id = $1 and occurrence_date = '2026-11-25'`, [r.id])).rows[0];

  const newId = (await db.query(`select split_recurrence($1, '{"title":"Йога 2"}'::jsonb, '2026-11-30') as id`, [t25.id])).rows[0].id;

  const old = (await taskDates(db, r.id)).map((x) => `${x.d} ${x.title}`);
  assert.deepEqual(old, [
    '2026-11-20 Йога', '2026-11-21 Йога', '2026-11-22 Йога', '2026-11-23 Йога', '2026-11-24 Йога',
    '2026-11-26 Йога', // выполненная сохранилась
  ]);
  const fresh = await taskDates(db, newId);
  assert.equal(fresh[0].d, '2026-11-25');
  assert.ok(fresh.every((x) => x.title === 'Йога 2'));
  const oldEnd = (await db.query(`select end_date::text as e from recurrences where id = $1`, [r.id])).rows[0].e;
  assert.equal(oldEnd, '2026-11-24');
});

test('split не трогает «только эта» (is_exception)', async () => {
  const db = await makeDb();
  const r = await addRec(db, { title: 'Йога', freq: 'daily', start_date: '2026-11-20' });
  await db.query(`select materialize($1, '2026-11-30')`, [A]);
  await db.query(`update tasks set title = 'Йога в парке', is_exception = true where recurrence_id = $1 and occurrence_date = '2026-11-28'`, [r.id]);
  const t22 = (await db.query(`select id from tasks where recurrence_id = $1 and occurrence_date = '2026-11-22'`, [r.id])).rows[0];
  await db.query(`select split_recurrence($1, '{"time":"07:00"}'::jsonb, '2026-11-30')`, [t22.id]);
  const exc = (await db.query(`select title from tasks where recurrence_id = $1 and occurrence_date = '2026-11-28'`, [r.id])).rows;
  assert.deepEqual(exc, [{ title: 'Йога в парке' }]);
});

test('end_recurrence_from: удалить эту и все следующие', async () => {
  const db = await makeDb();
  const r = await addRec(db, { freq: 'daily', start_date: '2026-11-20' });
  await db.query(`select materialize($1, '2026-11-25')`, [A]);
  const t23 = (await db.query(`select id from tasks where recurrence_id = $1 and occurrence_date = '2026-11-23'`, [r.id])).rows[0];
  await db.query(`select end_recurrence_from($1)`, [t23.id]);
  assert.deepEqual((await taskDates(db, r.id)).map((x) => x.d), ['2026-11-20', '2026-11-21', '2026-11-22']);
  await db.query(`select materialize($1, '2026-12-31')`, [A]);
  assert.equal((await taskDates(db, r.id)).length, 3);
});

test('обычная задача не задета materialize', async () => {
  const db = await makeDb();
  await insertTask(db, { user_id: A, title: 'Разовая', date: '2026-11-21' });
  await addRec(db, { freq: 'daily', start_date: '2026-11-20' });
  await db.query(`select materialize($1, '2026-11-22')`, [A]);
  const n = (await db.query(`select count(*)::int as n from tasks where recurrence_id is null`)).rows[0].n;
  assert.equal(n, 1);
});
