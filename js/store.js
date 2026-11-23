// Офлайн-хранилище: кэш таблиц в IndexedDB + очередь изменений (outbox).
// Правки сразу видны на экране, а на сервер уходят, когда есть связь.

export const TABLES = ['tasks', 'goals', 'special_dates', 'recurrences', 'images', 'task_history', 'settings'];
const KEYS = { settings: 'user_id' };

export class OfflineError extends Error {
  constructor() { super('Нет связи с интернетом'); this.name = 'OfflineError'; }
}

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const done = (tx) => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });

// Сетевая ошибка (нет связи) или ответ сервера с отказом?
const isNetworkError = (e) => e instanceof TypeError || /fetch|network|load failed/i.test(e?.message || '');

export function createStore({ client, indexedDB = globalThis.indexedDB, dbName = 'planner', autoFlush = true }) {
  const listeners = { change: new Set(), pending: new Set(), error: new Set() };
  const emit = (ev, arg) => listeners[ev].forEach((cb) => { try { cb(arg); } catch (e) { console.error(e); } });

  const dbp = new Promise((resolve, reject) => {
    const open = indexedDB.open(dbName, 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const t of TABLES) db.createObjectStore(t, { keyPath: KEYS[t] || 'id' });
      db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });

  async function outbox() {
    const db = await dbp;
    return req(db.transaction('outbox').objectStore('outbox').getAll());
  }

  async function list(table, filter) {
    const db = await dbp;
    const rows = await req(db.transaction(table).objectStore(table).getAll());
    refresh(table).catch(() => {});
    return filter ? rows.filter(filter) : rows;
  }

  async function refresh(table) {
    let res;
    try { res = await client.from(table).select('*'); } catch { return; }
    if (res.error) return;
    const pending = (await outbox()).filter((op) => op.table === table);
    const key = KEYS[table] || 'id';
    const pendingKeys = new Set(pending.map((op) => (op.op === 'delete' ? op.id : op.row[key])));
    const db = await dbp;
    const tx = db.transaction(table, 'readwrite');
    const st = tx.objectStore(table);
    // локальные версии строк с неотправленными правками сохраняем
    const keep = [];
    for (const k of pendingKeys) { const r = await req(st.get(k)); if (r) keep.push(r); }
    st.clear();
    for (const row of res.data) if (!pendingKeys.has(row[key])) st.put(row);
    for (const row of keep) st.put(row);
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
    const q = op.op === 'delete'
      ? client.from(op.table).delete().eq(key, op.id)
      : client.from(op.table).upsert(op.row);
    const res = await q;
    if (res.error) {
      if (isNetworkError(res.error)) throw new TypeError(res.error.message);
      return res.error; // сервер отказал
    }
    return null;
  }

  let running = null;
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

  return { list, refresh, upsert, remove, rpc, flush, pendingCount, on };
}
