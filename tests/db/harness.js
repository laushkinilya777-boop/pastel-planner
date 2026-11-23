// Тестовый Postgres в памяти (PGlite) с заглушками Supabase: auth.users, auth.uid(), роль authenticated.
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
const SKIP = new Set(['007_cron.sql', '008_storage.sql']); // в PGlite нет pg_cron и схемы storage

export const A = '00000000-0000-0000-0000-00000000000a';
export const B = '00000000-0000-0000-0000-00000000000b';

export async function makeDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    -- как в Supabase: новые функции в public по умолчанию доступны anon и authenticated
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql') && !SKIP.has(f)).sort();
  for (const f of files) {
    try {
      await db.exec(await readFile(MIGRATIONS + f, 'utf8'));
    } catch (e) {
      throw new Error(`миграция ${f}: ${e.message}`);
    }
  }
  return db;
}

// Выполняет fn(db) от имени пользователя uid (как запрос из браузера через Supabase).
export async function asUser(db, uid, fn) {
  await db.exec('begin');
  try {
    await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);`);
    const result = await fn(db);
    await db.exec('commit');
    return result;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}

// Выполняет fn(db) как гость без входа (роль anon).
export async function asAnon(db, fn) {
  await db.exec('begin');
  try {
    await db.exec('set local role anon');
    const result = await fn(db);
    await db.exec('commit');
    return result;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}

// Вставка задачи от имени владельца (обходит RLS: работает как postgres).
export async function insertTask(db, row) {
  const cols = Object.keys(row);
  const res = await db.query(
    `insert into tasks (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) returning *`,
    Object.values(row),
  );
  return res.rows[0];
}
