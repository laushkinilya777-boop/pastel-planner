import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createStore, OfflineError } from '../js/store.js';

// Поддельный клиент Supabase: таблицы в памяти, журнал успешных записей, «выдернутый интернет».
function fakeClient(initial = {}) {
  const tables = structuredClone(initial);
  const log = [];
  const c = {
    offline: false,
    failNext: 0, // сколько следующих запросов упадут как сетевые
    serverReject: null, // id строки, которую сервер отвергнет навсегда (конфликт 409)
    nextError: null, // { error, status } — следующий ответ сервера с ошибкой
    selectDelay: null, // Promise — задержать ответ select (снимок берётся в момент запроса)
    log,
    tables,
    net() {
      if (c.offline) throw new TypeError('Failed to fetch');
      if (c.failNext > 0) { c.failNext -= 1; throw new TypeError('Failed to fetch'); }
    },
    from(table) {
      tables[table] ??= [];
      return {
        select: async () => {
          c.net();
          const snap = structuredClone(tables[table]);
          if (c.selectDelay) await c.selectDelay;
          return { data: snap, error: null };
        },
        update: (changes) => ({
          eq: async (_col, id) => {
            c.net();
            if (c.nextError) { const e = c.nextError; c.nextError = null; return { data: null, ...e }; }
            const row = tables[table].find((r) => r.id === id);
            if (row) Object.assign(row, changes);
            log.push(`update ${table} ${id} ${Object.keys(changes).sort().join(',')}`);
            return { data: null, error: null, status: 204 };
          },
        }),
        upsert: async (row) => {
          c.net();
          if (c.nextError) { const e = c.nextError; c.nextError = null; return { data: null, ...e }; }
          if (row.id === c.serverReject) return { data: null, error: { code: '23505', message: 'duplicate key' }, status: 409 };
          const i = tables[table].findIndex((r) => r.id === row.id);
          if (i >= 0) tables[table][i] = { ...row }; else tables[table].push({ ...row });
          log.push(`upsert ${table} ${row.title ?? row.id}`);
          return { data: null, error: null };
        },
        delete: () => ({
          eq: async (_col, id) => {
            c.net();
            tables[table] = tables[table].filter((r) => r.id !== id);
            log.push(`delete ${table} ${id}`);
            return { data: null, error: null };
          },
        }),
      };
    },
    rpc: async (name) => { c.net(); return { data: `ok:${name}`, error: null }; },
  };
  return c;
}

const mk = (client) => createStore({ client, indexedDB: new IDBFactory(), dbName: 't', autoFlush: false });

test('upsert офлайн попадает в кэш и очередь', async () => {
  const client = fakeClient();
  client.offline = true;
  const store = mk(client);
  const row = await store.upsert('tasks', { title: 'Йога', date: '2026-11-23' });
  assert.ok(row.id);
  assert.ok(row.updated_at);
  assert.equal(await store.pendingCount(), 1);
  const rows = await store.list('tasks');
  assert.deepEqual(rows.map((r) => r.title), ['Йога']);
});

test('flush после восстановления сети отправляет в порядке A, B, C', async () => {
  const client = fakeClient();
  client.offline = true;
  const store = mk(client);
  for (const t of ['A', 'B', 'C']) await store.upsert('tasks', { title: t, date: '2026-11-23' });
  await store.flush();
  assert.deepEqual(client.log, []);
  client.offline = false;
  await store.flush();
  assert.deepEqual(client.log, ['upsert tasks A', 'upsert tasks B', 'upsert tasks C']);
  assert.equal(await store.pendingCount(), 0);
});

test('частичная ошибка + повторный flush = ровно один upsert на строку, порядок сохранён', async () => {
  const client = fakeClient();
  client.offline = true;
  const store = mk(client);
  for (const t of ['A', 'B', 'C']) await store.upsert('tasks', { title: t, date: '2026-11-23' });
  client.offline = false;
  client.failNext = 0;
  // A уйдёт, на B сеть моргнёт
  const origUpsert = client.from;
  let calls = 0;
  client.from = (table) => {
    const api = origUpsert(table);
    const up = api.upsert;
    api.upsert = async (row) => { calls += 1; if (calls === 2) throw new TypeError('Failed to fetch'); return up(row); };
    return api;
  };
  await store.flush();
  assert.deepEqual(client.log, ['upsert tasks A']);
  assert.equal(await store.pendingCount(), 2);
  await store.flush();
  await store.flush();
  assert.deepEqual(client.log, ['upsert tasks A', 'upsert tasks B', 'upsert tasks C']);
});

test('refresh не затирает строку с неотправленной правкой', async () => {
  const id = '11111111-1111-1111-1111-111111111111';
  const client = fakeClient({ tasks: [{ id, title: 'Старое', date: '2026-11-23' }] });
  const store = mk(client);
  await store.refresh('tasks');
  client.offline = true;
  await store.upsert('tasks', { id, title: 'Новое', date: '2026-11-23' });
  client.offline = false;
  client.serverReject = id; // не дадим отправить, чтобы правка оставалась в очереди
  client.failNext = 0;
  await store.refresh('tasks');
  const rows = await store.list('tasks');
  assert.equal(rows.find((r) => r.id === id).title, 'Новое');
});

test('refresh подтягивает строки с сервера', async () => {
  const client = fakeClient({ tasks: [{ id: 'x1', title: 'С компьютера', date: '2026-11-23' }] });
  const store = mk(client);
  await store.refresh('tasks');
  assert.deepEqual((await store.list('tasks')).map((r) => r.title), ['С компьютера']);
});

test('remove офлайн убирает из кэша и потом удаляет на сервере', async () => {
  const client = fakeClient({ tasks: [{ id: 'x1', title: 'Лишняя', date: '2026-11-23' }] });
  const store = mk(client);
  await store.refresh('tasks');
  client.offline = true;
  await store.remove('tasks', 'x1');
  assert.deepEqual(await store.list('tasks'), []);
  client.offline = false;
  await store.flush();
  assert.deepEqual(client.log, ['delete tasks x1']);
});

test('сервер отверг изменение: оно убирается из очереди, событие error', async () => {
  const client = fakeClient();
  const store = mk(client);
  client.serverReject = 'bad';
  const errors = [];
  store.on('error', (e) => errors.push(e.message));
  await store.upsert('tasks', { id: 'bad', title: 'x', date: '2026-11-23' });
  await store.flush();
  assert.equal(await store.pendingCount(), 0);
  assert.deepEqual(errors, ['duplicate key']);
});

test('rpc офлайн бросает OfflineError', async () => {
  const client = fakeClient();
  client.offline = true;
  const store = mk(client);
  await assert.rejects(store.rpc('run_daily', {}), OfflineError);
  client.offline = false;
  assert.equal(await store.rpc('run_daily', {}), 'ok:run_daily');
});

test('событие change приходит после upsert', async () => {
  const client = fakeClient();
  const store = mk(client);
  const seen = [];
  store.on('change', (t) => seen.push(t));
  await store.upsert('goals', { title: 'Книги' });
  assert.deepEqual(seen, ['goals']);
});

test('list не дёргает сервер чаще раза в 15 секунд', async () => {
  const client = fakeClient({ tasks: [{ id: 'x1', title: 'A', date: '2026-11-23' }] });
  let selects = 0;
  const from = client.from;
  client.from = (t) => { const api = from(t); const sel = api.select; api.select = async () => { selects += 1; return sel(); }; return api; };
  const store = mk(client);
  await store.list('tasks');
  await new Promise((r) => setTimeout(r, 20));
  await store.list('tasks');
  await store.list('tasks');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(selects, 1);
});

test('refresh без изменений не шлёт change (нет бесконечной перерисовки)', async () => {
  const client = fakeClient({ tasks: [{ id: 'x1', title: 'A', date: '2026-11-23' }] });
  const store = mk(client);
  await store.refresh('tasks');
  let changes = 0;
  store.on('change', () => { changes += 1; });
  await store.refresh('tasks');
  assert.equal(changes, 0);
  client.tables.tasks[0].title = 'B';
  await store.refresh('tasks');
  assert.equal(changes, 1);
});

test('C2: ошибка сервера 503 оставляет правку в очереди', async () => {
  const client = fakeClient();
  const store = mk(client);
  client.nextError = { error: { message: 'Service Unavailable' }, status: 503 };
  await store.upsert('tasks', { title: 'A', date: '2026-11-23' });
  await store.flush();
  assert.equal(await store.pendingCount(), 1);
  await store.flush();
  assert.equal(await store.pendingCount(), 0);
  assert.deepEqual(client.log, ['upsert tasks A']);
});

test('C2: 401/403 (протух вход) оставляет правку', async () => {
  const client = fakeClient();
  const store = mk(client);
  client.nextError = { error: { code: '42501', message: 'row-level security' }, status: 403 };
  await store.upsert('tasks', { title: 'A', date: '2026-11-23' });
  await store.flush();
  assert.equal(await store.pendingCount(), 1);
});

test('I2: patch отправляет только изменённые поля', async () => {
  const id = 'p1';
  const client = fakeClient({ tasks: [{ id, title: 'Йога', date: '2026-11-23', note: null, reminded_at: '2026-11-23T05:45:00Z' }] });
  const store = mk(client);
  await store.refresh('tasks');
  await store.patch('tasks', id, { note: 'коврик' });
  await store.flush();
  assert.deepEqual(client.log, ['update tasks p1 note,updated_at']);
  assert.equal(client.tables.tasks[0].reminded_at, '2026-11-23T05:45:00Z');
  const cached = (await store.list('tasks'))[0];
  assert.equal(cached.note, 'коврик');
  assert.equal(cached.reminded_at, '2026-11-23T05:45:00Z');
});

test('I5: refresh, начатый до отправки правки, не откатывает её в кэше', async () => {
  const id = 'r1';
  const client = fakeClient({ tasks: [{ id, title: 'Старое', date: '2026-11-23' }] });
  const store = mk(client);
  await store.refresh('tasks');
  client.offline = true;
  await store.patch('tasks', id, { title: 'Новое' });
  client.offline = false;
  let release;
  client.selectDelay = new Promise((r) => { release = r; });
  const pending = store.refresh('tasks'); // снимок сервера — ещё «Старое»
  await new Promise((r) => setTimeout(r, 5));
  client.selectDelay = null;
  await store.flush(); // правка ушла, очередь пуста
  release();
  await pending;
  assert.equal((await store.list('tasks'))[0].title, 'Новое');
});

test('обновление базы браузера с версии 1 сохраняет очередь и добавляет новые таблицы', async () => {
  const idb = new IDBFactory();
  await new Promise((res, rej) => {
    const o = idb.open('up', 1);
    o.onupgradeneeded = () => {
      const db = o.result;
      for (const t of ['tasks', 'goals', 'special_dates', 'recurrences', 'images', 'task_history', 'settings']) db.createObjectStore(t, { keyPath: t === 'settings' ? 'user_id' : 'id' });
      db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true }).add({ op: 'upsert', table: 'tasks', row: { id: 'old', title: 'Старая' } });
    };
    o.onsuccess = () => { o.result.close(); res(); };
    o.onerror = () => rej(o.error);
  });
  const client = fakeClient();
  client.offline = true;
  const store = createStore({ client, indexedDB: idb, dbName: 'up', autoFlush: false });
  assert.equal(await store.pendingCount(), 1);
  await store.upsert('habits', { title: 'Вода' });
  assert.deepEqual((await store.list('habits')).map((h) => h.title), ['Вода']);
});
