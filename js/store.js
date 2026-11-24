// Офлайн-хранилище: кэш таблиц в IndexedDB + очередь изменений (outbox).
// Правки сразу видны на экране, а на сервер уходят, когда есть связь.

export const TABLES = ['tasks', 'goals', 'special_dates', 'recurrences', 'images', 'task_history', 'settings', 'habits', 'habit_logs', 'savings_jars', 'money_entries', 'budget_plans', 'ideas', 'image_categories'];
const KEYS = { settings: 'user_id' };

export class OfflineError extends Error {
  constructor() { super('Нет связи с интернетом'); this.name = 'OfflineError'; }
}

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const done = (tx) => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });

// Сетевая ошибка (нет связи) или ответ сервера с отказом?
const isNetworkError = (e) => e instanceof TypeError || /fetch|network|load failed/i.test(e?.message || '');

// Отказ навсегда — только явная ошибка данных (400/404/409/422 или коды 22xxx/23xxx/PGRST1xx при не-5xx).
// Всё остальное (5xx, 401/403 при протухшем входе, 408, 429, нет статуса) — временно: правку оставляем в очереди.
export function isPermanentRejection(error, status) {
  if (status >= 500 || [401, 403, 408, 429].includes(status)) return false;
  if ([400, 404, 409, 422].includes(status)) return true;
  return /^(22|23)\d{3}$|^PGRST1/.test(String(error?.code || ''));
}
const opKey = (op, key) => (op.op === 'delete' || op.op === 'update' ? op.id : op.row[key]);

export function createStore({ client, indexedDB = globalThis.indexedDB, dbName = 'planner', autoFlush = true }) {
  const listeners = { change: new Set(), pending: new Set(), error: new Set() };
  const emit = (ev, arg) => listeners[ev].forEach((cb) => { try { cb(arg); } catch (e) { console.error(e); } });

  const dbp = new Promise((resolve, reject) => {
    // версия 2 — привычки, бюджет, идеи; 3 — свои категории картинок; существующие хранилища не трогаем
    const open = indexedDB.open(dbName, 3);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const t of TABLES) if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: KEYS[t] || 'id' });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });

  async function outbox() {
    const db = await dbp;
    return req(db.transaction('outbox').objectStore('outbox').getAll());
  }

  // Фоновая подгрузка с сервера — не чаще раза в REFRESH_MS на таблицу.
  const REFRESH_MS = 15000;
  const lastPull = {};
  async function list(table, filter) {
    const db = await dbp;
    const rows = await req(db.transaction(table).objectStore(table).getAll());
    if (!lastPull[table] || Date.now() - lastPull[table] > REFRESH_MS) {
      lastPull[table] = Date.now();
      refresh(table).catch(() => {});
    }
    return filter ? rows.filter(filter) : rows;
  }

  async function refresh(table) {
    let res;
    lastPull[table] = Date.now();
    const key = KEYS[table] || 'id';
    const keysOf = async () => (await outbox()).filter((op) => op.table === table).map((op) => opKey(op, key));
    // ключи правок, ждавших отправки ДО запроса: ответ сервера мог быть снят раньше, чем они дошли
    const before0 = new Set(await keysOf());
    const gen0 = flushGen;
    try { res = await client.from(table).select('*'); } catch { return; }
    if (res.error) return;
    const pendingKeys = new Set([...before0, ...(await keysOf())]);
    if (flushGen !== gen0 && pendingKeys.size) {
      // пока шёл запрос, правки ушли на сервер — ответ мог устареть, запросим ещё раз позже
      lastPull[table] = 0;
    }
    const db = await dbp;
    const tx = db.transaction(table, 'readwrite');
    const st = tx.objectStore(table);
    // локальные версии строк с неотправленными правками сохраняем
    const before = await req(st.getAll());
    const keep = before.filter((r) => pendingKeys.has(r[key]));
    const next = [...res.data.filter((row) => !pendingKeys.has(row[key])), ...keep];
    const sig = (rows) => JSON.stringify([...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key]))));
    if (sig(before) === sig(next)) { await done(tx); return; } // ничего не изменилось — не перерисовываем
    st.clear();
    for (const row of next) st.put(row);
    await done(tx);
    emit('change', table);
  }

  async function enqueue(table, cacheWrite, op) {
    const db = await dbp;
    const tx = db.transaction([table, 'outbox'], 'readwrite');
    cacheWrite(tx.objectStore(table));
    tx.objectStore('outbox').add(op);
    await done(tx);
    emit('change', table);
    emit('pending', await pendingCount());
    if (autoFlush) flush().catch(() => {});
  }

  async function upsert(table, row) {
    const key = KEYS[table] || 'id';
    const full = { ...row, [key]: row[key] ?? crypto.randomUUID(), updated_at: new Date().toISOString() };
    await enqueue(table, (st) => st.put(full), { op: 'upsert', table, row: full });
    return full;
  }

  // Правка существующей строки: на сервер уходят только изменённые поля.
  async function patch(table, id, changes) {
    const key = KEYS[table] || 'id';
    const ch = { ...changes, updated_at: new Date().toISOString() };
    delete ch[key];
    let merged = null;
    await enqueue(table, (st) => {
      const r = st.get(id);
      r.onsuccess = () => { merged = { ...(r.result || { [key]: id }), ...ch }; st.put(merged); };
    }, { op: 'update', table, id, changes: ch });
    return merged;
  }

  async function remove(table, id) {
    await enqueue(table, (st) => st.delete(id), { op: 'delete', table, id });
  }

  async function rpc(name, args) {
    if (globalThis.navigator?.onLine === false) throw new OfflineError();
    let res;
    try { res = await client.rpc(name, args); } catch (e) { if (isNetworkError(e)) throw new OfflineError(); throw e; }
    if (res.error) { if (isNetworkError(res.error)) throw new OfflineError(); throw res.error; }
    return res.data;
  }

  async function send(op) {
    const key = KEYS[op.table] || 'id';
    const q = op.op === 'delete' ? client.from(op.table).delete().eq(key, op.id)
      : op.op === 'update' ? client.from(op.table).update(op.changes).eq(key, op.id)
        : client.from(op.table).upsert(op.row);
    const res = await q;
    if (res.error) {
      if (isNetworkError(res.error) || !isPermanentRejection(res.error, res.status)) throw new TypeError(res.error.message);
      return res.error; // сервер отказал навсегда
    }
    return null;
  }

  let running = null;
  let flushGen = 0;
  function flush() {
    if (running) return running;
    running = (async () => {
      try {
        if (globalThis.navigator?.onLine === false) return;
        const db = await dbp;
        for (;;) {
          const [op] = await outbox();
          if (!op) break;
          let rejected;
          try { rejected = await send(op); } catch (e) { if (isNetworkError(e)) break; throw e; }
          await req(db.transaction('outbox', 'readwrite').objectStore('outbox').delete(op.seq));
          flushGen += 1;
          emit('pending', await pendingCount());
          if (rejected) { emit('error', rejected); await refresh(op.table); }
        }
      } finally {
        running = null;
      }
    })();
    return running;
  }

  async function pendingCount() {
    return (await outbox()).length;
  }

  const on = (ev, cb) => { listeners[ev].add(cb); return () => listeners[ev].delete(cb); };

  if (autoFlush && typeof window !== 'undefined') {
    window.addEventListener('online', () => flush().catch(() => {}));
    setInterval(async () => { if ((await pendingCount()) > 0) flush().catch(() => {}); }, 30000);
  }

  return { list, refresh, upsert, patch, remove, rpc, flush, pendingCount, on };
}
