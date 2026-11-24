import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb, asUser, insertTask, A, B } from './harness.js';

test('history: смена date и title пишет 2 строки', async () => {
  const db = await makeDb();
  const t = await insertTask(db, { user_id: A, title: 'Йога', date: '2026-11-22' });
  await db.query(`update tasks set date = '2026-11-23', title = 'Йога утром' where id = $1`, [t.id]);
  const h = (await db.query(`select field, old_value, new_value from task_history where task_id = $1 order by field`, [t.id])).rows;
  assert.deepEqual(h, [
    { field: 'date', old_value: '2026-11-22', new_value: '2026-11-23' },
    { field: 'title', old_value: 'Йога', new_value: 'Йога утром' },
  ]);
});

test('history: смена только done не пишет историю', async () => {
  const db = await makeDb();
  const t = await insertTask(db, { user_id: A, title: 'Йога', date: '2026-11-22' });
  await db.query(`update tasks set done = true where id = $1`, [t.id]);
  const n = (await db.query(`select count(*)::int as n from task_history where task_id = $1`, [t.id])).rows[0].n;
  assert.equal(n, 0);
});

test('history: смена времени пишется как HH:MM:SS', async () => {
  const db = await makeDb();
  const t = await insertTask(db, { user_id: A, title: 'Йога', date: '2026-11-22', time: '09:00' });
  await db.query(`update tasks set time = '10:30' where id = $1`, [t.id]);
  const h = (await db.query(`select field, old_value, new_value from task_history where task_id = $1`, [t.id])).rows;
  assert.deepEqual(h, [{ field: 'time', old_value: '09:00:00', new_value: '10:30:00' }]);
});

test('rls: пользователь B не видит задачи пользователя A', async () => {
  const db = await makeDb();
  await insertTask(db, { user_id: A, title: 'Секрет', date: '2026-11-22' });
  const rows = await asUser(db, B, async (d) => (await d.query('select * from tasks')).rows);
  assert.equal(rows.length, 0);
  const own = await asUser(db, A, async (d) => (await d.query('select * from tasks')).rows);
  assert.equal(own.length, 1);
});

test('rls: пользователь B не может обновить задачу A', async () => {
  const db = await makeDb();
  const t = await insertTask(db, { user_id: A, title: 'Секрет', date: '2026-11-22' });
  const res = await asUser(db, B, (d) => d.query(`update tasks set title = 'взлом' where id = $1`, [t.id]));
  assert.equal(res.affectedRows, 0);
});

test('rls: B не может вставить строку от имени A', async () => {
  const db = await makeDb();
  await assert.rejects(asUser(db, B, (d) =>
    d.query(`insert into tasks (user_id, title, date) values ($1, 'x', '2026-11-22')`, [A])));
});

test('rls: user_id проставляется сам из входа', async () => {
  const db = await makeDb();
  const row = await asUser(db, A, async (d) =>
    (await d.query(`insert into tasks (title, date) values ('Моя', '2026-11-22') returning user_id`)).rows[0]);
  assert.equal(row.user_id, A);
});

test('rls включён на всех таблицах', async () => {
  const db = await makeDb();
  const rows = (await db.query(`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)).rows;
  assert.deepEqual(rows, []);
});

test('unique: вторая задача с тем же (recurrence_id, occurrence_date) падает', async () => {
  const db = await makeDb();
  const r = (await db.query(`insert into recurrences (user_id, title, freq, start_date)
    values ($1, 'Витамины', 'daily', '2026-11-20') returning id`, [A])).rows[0];
  await insertTask(db, { user_id: A, title: 'Витамины', date: '2026-11-21', recurrence_id: r.id, occurrence_date: '2026-11-21' });
  await assert.rejects(insertTask(db, { user_id: A, title: 'Витамины', date: '2026-11-22', recurrence_id: r.id, occurrence_date: '2026-11-21' }));
});

test('updated_at обновляется при изменении', async () => {
  const db = await makeDb();
  const t = await insertTask(db, { user_id: A, title: 'Йога', date: '2026-11-22', updated_at: '2020-01-01T00:00:00Z' });
  const u = (await db.query(`update tasks set note = 'коврик' where id = $1 returning updated_at`, [t.id])).rows[0];
  assert.ok(u.updated_at > new Date('2025-01-01'));
});

test('extras: новые таблицы под RLS, чужие данные не видны', async () => {
  const db = await makeDb();
  for (const t of ['habits', 'savings_jars', 'ideas']) {
    await db.query(`insert into ${t} (user_id, title) values ($1, 'A')`, [A]);
    const rows = await asUser(db, B, async (d) => (await d.query(`select * from ${t}`)).rows);
    assert.equal(rows.length, 0, t);
  }
});

test('extras: одна отметка привычки в день', async () => {
  const db = await makeDb();
  const h = (await db.query(`insert into habits (user_id, title) values ($1, 'Вода') returning id`, [A])).rows[0];
  await db.query(`insert into habit_logs (user_id, habit_id, date) values ($1, $2, '2026-11-24')`, [A, h.id]);
  await assert.rejects(db.query(`insert into habit_logs (user_id, habit_id, date) values ($1, $2, '2026-11-24')`, [A, h.id]));
});

test('extras: сумма записи бюджета > 0, у задачи есть due_time', async () => {
  const db = await makeDb();
  await assert.rejects(db.query(`insert into money_entries (user_id, date, kind, amount) values ($1, '2026-11-24', 'expense', 0)`, [A]));
  const t = await insertTask(db, { user_id: A, title: 'Отчёт', date: '2026-11-24', due_time: '18:00' });
  assert.equal(t.due_time, '18:00:00');
});

test('extras 2: свои категории картинок под RLS', async () => {
  const db = await makeDb();
  await db.query(`insert into image_categories (user_id, name) values ($1, 'Цветы')`, [A]);
  const rows = await asUser(db, B, async (d) => (await d.query('select * from image_categories')).rows);
  assert.equal(rows.length, 0);
});

test('fix C1: sort = Date.now() помещается в habits и budget_plans', async () => {
  const db = await makeDb();
  await db.query(`insert into habits (user_id, title, sort) values ($1, 'Вода', $2)`, [A, Date.now()]);
  await db.query(`insert into budget_plans (user_id, month, category, planned, sort) values ($1, '2026-11-01', 'Еда', 1000, $2)`, [A, Date.now()]);
});

test('fix: settings.plans_copied хранит месяцы, куда план уже перенесён', async () => {
  const db = await makeDb();
  await db.query(`insert into settings (user_id, plans_copied) values ($1, array['2026-12-01']::date[])`, [A]);
});
