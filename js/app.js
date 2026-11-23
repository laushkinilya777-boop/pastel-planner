// Точка входа: вход, меню, страницы, синхронизация, тема дня.
import { client, store } from './supabase.js';
import { renderAuth } from './auth.js';
import { parseRoute } from './router.js';
import { renderNav } from './ui/nav.js';
import { icon, hydrateIcons } from './ui/icons.js';
import { todayISO } from './dates.js';
import { initDailyTheme, createWeatherChip, onWeatherPicked, applyServerDay } from './theme.js';
import { placeholder } from './pages/placeholder.js';

const PAGES = {
  today: () => import('./pages/today.js').catch(() => placeholder('Сегодня', 'sun', 'Здесь появится план на сегодня — шаг 8')),
  day: () => import('./pages/day.js').catch(() => placeholder('День', 'sun', 'Здесь появится план выбранного дня — шаг 8')),
  week: () => import('./pages/week.js').catch(() => placeholder('Неделя', 'week', 'Здесь появятся цели и задачи недели — шаг 9')),
  month: () => import('./pages/month.js').catch(() => placeholder('Месяц', 'month', 'Здесь появится календарь месяца — шаг 9')),
  images: () => import('./pages/images.js').catch(() => placeholder('Картинки', 'gallery', 'Здесь появится твоя подборка картинок — шаг 10')),
};

const nav = document.getElementById('nav');
const main = document.getElementById('app');
const top = document.getElementById('top-bar');
let cleanup = null;
let user = null;

async function show() {
  const { name, params } = parseRoute(location.hash);
  renderNav(nav, name);
  cleanup?.();
  cleanup = null;
  const mod = await PAGES[name]();
  main.innerHTML = '';
  cleanup = (await mod.render(main, params, { user })) || null;
  main.focus({ preventScroll: true });
}

async function ensureSettings() {
  const today = todayISO();
  const rows = await store.list('settings');
  let row = rows.find((r) => r.user_id === user.id);
  if (!row) {
    const { data } = await client.from('settings').select('*').eq('user_id', user.id).maybeSingle();
    row = data;
  }
  if (!row) {
    row = await store.upsert('settings', { user_id: user.id, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow' });
  }
  applyServerDay(row, today);
}

async function dailyWork() {
  try { await store.rpc('run_daily', {}); } catch { /* офлайн — догоним позже */ }
  store.flush().catch(() => {});
}

function renderSyncBadge() {
  const badge = document.createElement('span');
  badge.className = 'sync-badge';
  badge.hidden = true;
  badge.innerHTML = `${icon('cloudOff', 16)}<span>не синхронизировано</span>`;
  store.on('pending', (n) => { badge.hidden = n === 0; });
  store.pendingCount().then((n) => { badge.hidden = n === 0; });
  return badge;
}

function startApp() {
  document.body.classList.remove('signed-out');
  const today = todayISO();
  top.innerHTML = '';
  top.append(renderSyncBadge(), createWeatherChip(today));
  onWeatherPicked((date, weather) =>
    store.upsert('settings', { user_id: user.id, day_date: date, day_weather: weather }).catch(() => {}));
  initDailyTheme(today);
  ensureSettings().catch(() => {});
  store.on('change', (table) => {
    if (table === 'settings') store.list('settings').then((rs) => applyServerDay(rs.find((r) => r.user_id === user.id), todayISO()));
  });
  dailyWork();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') dailyWork(); });
  window.addEventListener('hashchange', show);
  show();
}

function showAuth() {
  document.body.classList.add('signed-out');
  nav.innerHTML = '';
  top.innerHTML = '';
  renderAuth(main);
}

hydrateIcons();
const { data: { session } } = await client.auth.getSession();
user = session?.user || null;
if (user) startApp(); else showAuth();

client.auth.onAuthStateChange((event, s) => {
  if (event === 'SIGNED_IN' && !user) { user = s.user; startApp(); }
  if (event === 'SIGNED_OUT') { user = null; showAuth(); }
});
