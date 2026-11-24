// Поддельный supabase-js для проверки интерфейса без настоящей базы (только dev/index.html).
const uid = '00000000-0000-0000-0000-0000000000aa';
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = iso(new Date());
const yesterday = iso(new Date(Date.now() - 86400000));
const now = () => new Date().toISOString();
const _d = new Date(); _d.setDate(_d.getDate() - ((_d.getDay() + 6) % 7));
const weekMon = iso(_d);

const db = {
  tasks: [
    { id: 't1', title: 'Йога', date: today, time: '09:00:00', done: false, carry_count: 0, remind_minutes: 15, created_at: now() },
    { id: 't2', title: 'Позвонить маме', date: today, time: '11:30:00', done: true, carry_count: 0, remind_minutes: 15, created_at: now() },
    { id: 't3', title: 'Дописать отчёт', date: today, time: '15:00:00', done: false, carry_count: 2, remind_minutes: null, created_at: now(), note: 'раздел 3 и выводы' },
    { id: 't4', title: 'Купить корм котику', date: today, time: null, due_time: '18:00:00', done: false, carry_count: 0, created_at: now() },
    { id: 't9', title: 'Оплатить интернет', date: today, time: null, due_time: '00:30:00', done: false, carry_count: 0, created_at: now() },
    { id: 't5', title: 'Витамины', date: today, time: '08:00:00', done: false, carry_count: 0, recurrence_id: 'r1', occurrence_date: today, remind_minutes: 15, created_at: now() },
  ].concat([
    { id: 't6', title: 'Маникюр', date: iso(new Date(_d.getTime() + 5 * 86400000)), time: '12:00:00', done: false, carry_count: 0, created_at: now() },
    { id: 't7', title: 'Кино с подругой', date: iso(new Date(_d.getTime() + 5 * 86400000)), time: '19:00:00', done: false, carry_count: 0, created_at: now() },
    { id: 't8', title: 'Отчёт начальнику', date: iso(new Date(Date.now() + 86400000)), time: '10:00:00', done: false, carry_count: 0, created_at: now() },
  ]),
  recurrences: [{ id: 'r1', title: 'Витамины', time: '08:00:00', freq: 'daily', weekdays: null, start_date: yesterday, end_date: null }],
  task_history: [
    { id: 1, task_id: 't3', field: 'date', old_value: yesterday, new_value: today, changed_at: now() },
  ],
  goals: [
    { id: 'g1', title: 'Прочитать 2 книги', target: 2, manual_adjust: 1, period: 'week', period_start: weekMon },
    { id: 'g2', title: 'Йога 12 раз', target: 12, manual_adjust: 4, period: 'month', period_start: today.slice(0, 8) + '01' },
  ],
  special_dates: [
    { id: 's1', title: 'ДР мамы', date: '1970-' + today.slice(5, 8) + '27', kind: 'red', color: '#e8577f', yearly: true },
    { id: 's2', title: 'Сдать проект', date: today.slice(0, 8) + '28', kind: 'deadline', yearly: false },
  ],
  images: [
    { id: 'i1', kind: 'quote', text: 'Маленькие шаги — тоже шаги', category: 'motivation', created_at: now() },
    { id: 'i2', kind: 'link', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=900', category: 'cats', created_at: now() },
  ],
  settings: [{ user_id: uid, tz: 'Europe/Moscow' }],
  savings_jars: [{ id: 'j1', title: 'Отпуск', target: 60000, color: 'peach', archived: false }],
  money_entries: [
    { id: 'm1', date: today.slice(0, 8) + '01', kind: 'income', amount: 45000, source: 'Зарплата', created_at: now() },
    { id: 'm2', date: today.slice(0, 8) + '03', kind: 'expense', amount: 3200, target: 'Продукты', created_at: now() },
    { id: 'm3', date: today.slice(0, 8) + '10', kind: 'expense', amount: 1800, target: 'Кафе', note: 'с подругой', created_at: now() },
    { id: 'm4', date: today.slice(0, 8) + '15', kind: 'save', amount: 8000, jar_id: 'j1', created_at: now() },
    { id: 'm5', date: today.slice(0, 8) + '18', kind: 'expense', amount: 5600, target: 'Одежда', created_at: now() },
  ],
  budget_plans: [
    { id: 'p1', month: today.slice(0, 8) + '01', category: 'Продукты', kind: 'expense', planned: 10000, sort: 1 },
    { id: 'p2', month: today.slice(0, 8) + '01', category: 'Кафе', kind: 'expense', planned: 1500, sort: 2 },
  ],
  ideas: [
    { id: 'v1', title: 'Мой вечерний уход за кожей', hook: 'Я перестала смывать макияж водой — и вот что случилось', platform: 'both', tags: ['уход', 'вечер'], status: 'script', publish_date: today, created_at: now() },
    { id: 'v2', title: '5 привычек, которые изменили моё утро', platform: 'reels', tags: ['утро'], status: 'idea', created_at: now() },
    { id: 'v3', title: 'Котик против пылесоса', platform: 'tiktok', tags: ['котик'], status: 'published', created_at: now() },
  ],
  habits: [
    { id: 'h1', title: 'Вода 2 л', color: 'sky', weekdays: null, archived: false, sort: 1 },
    { id: 'h2', title: 'Чтение 20 минут', color: 'lilac', weekdays: null, archived: false, sort: 2 },
    { id: 'h3', title: 'Зарядка', color: 'mint', weekdays: [1, 3, 5], archived: false, sort: 3 },
  ],
  habit_logs: [1, 2, 3, 4].map((k) => ({ id: 'l' + k, habit_id: 'h1', date: iso(new Date(Date.now() - k * 86400000)) }))
    .concat([{ id: 'l9', habit_id: 'h2', date: iso(new Date(Date.now() - 86400000)) }]),
};

function query(table) {
  db[table] ??= [];
  const q = {
    _filters: [],
    select() { return q; },
    eq(col, val) { q._filters.push([col, val]); return q; },
    limit() { return q; },
    maybeSingle() { return Promise.resolve({ data: q._rows()[0] || null, error: null }); },
    _rows() { return db[table].filter((r) => q._filters.every(([c, v]) => r[c] === v)); },
    then(res, rej) { return Promise.resolve({ data: structuredClone(q._rows()), error: null }).then(res, rej); },
    upsert(row, opts = {}) {
      const key = table === 'settings' ? 'user_id' : 'id';
      if (Array.isArray(row)) {
        for (const r of row) { if (!(opts.ignoreDuplicates && db[table].some((x) => x[key] === r[key]))) q.upsert(r); }
        return Promise.resolve({ data: null, error: null });
      }
      const i = db[table].findIndex((r) => r[key] === row[key]);
      if (i >= 0) db[table][i] = { ...db[table][i], ...row }; else db[table].push({ ...row });
      return Promise.resolve({ data: null, error: null });
    },
    update(changes) {
      return { eq: (c, v) => { db[table].filter((r) => r[c] === v).forEach((r) => Object.assign(r, changes)); return Promise.resolve({ error: null, status: 204 }); } };
    },
    insert(row) { db[table].push({ id: crypto.randomUUID(), ...row }); return Promise.resolve({ data: null, error: null }); },
    delete() { return { eq: (c, v) => { db[table] = db[table].filter((r) => r[c] !== v); return Promise.resolve({ error: null }); } }; },
  };
  return q;
}

export function createClient() {
  const session = { user: { id: uid, email: 'demo@example.com', user_metadata: { has_password: true } } };
  return {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: async () => ({ data: session, error: null }),
      updateUser: async () => ({ data: {}, error: null }),
    },
    from: query,
    rpc: async (name, args) => {
      console.info('[fake rpc]', name, args);
      return { data: null, error: null };
    },
  };
}
