// Точка входа: вход, меню, страницы, синхронизация, тема дня.
import { client, store } from './supabase.js';
import { renderAuth, renderSetPassword } from './auth.js';
import { needsPassword } from './auth-utils.js';
import { parseRoute } from './router.js';
import { renderNav } from './ui/nav.js';
import { icon, hydrateIcons } from './ui/icons.js';
import { todayISO } from './dates.js';
import { initDailyTheme, createWeatherChip, onWeatherPicked, applyServerDay } from './theme.js';
import { placeholder } from './pages/placeholder.js';
import { backfillStarterMoods } from './ui/starter-picker.js';
import { currentAvailability, isPushOn, enablePush } from './push.js';
import { openSheet, toast } from './ui/sheet.js';

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
  await store.flush().catch(() => {});
  // подтянуть правки, сделанные на другом устройстве
  for (const t of ['tasks', 'recurrences', 'goals', 'special_dates', 'settings']) store.refresh(t).catch(() => {});
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

let started = false;
// Колокольчик в шапке: виден, пока напоминания на этом устройстве не включены.
function renderBell() {
  const b = document.createElement('button');
  b.className = 'weather-chip bell-chip';
  b.type = 'button';
  b.hidden = true;
  b.innerHTML = `${icon('bell', 18)}<span>Напоминания</span>`;
  b.setAttribute('aria-label', 'Включить напоминания');
  const avail = currentAvailability();
  if (avail !== 'unsupported') isPushOn().then((on) => { b.hidden = on; }).catch(() => { b.hidden = false; });
  b.addEventListener('click', async () => {
    if (currentAvailability() === 'need-home-screen') {
      openSheet({
        title: 'Напоминания на iPhone',
        build(body) {
          body.innerHTML = `<ol class="howto">
            <li>Открой этот сайт в <b>Safari</b></li>
            <li>Нажми <b>«Поделиться»</b> (квадрат со стрелкой вверх)</li>
            <li>Выбери <b>«На экран „Домой“»</b> → <b>«Добавить»</b></li>
            <li>Открой планер <b>со значка</b> на экране и нажми колокольчик ещё раз</li></ol>
            <p class="hint">Так iPhone разрешает сайтам присылать уведомления (нужна iOS 16.4 или новее)</p>`;
        },
      });
      return;
    }
    b.disabled = true;
    try { await enablePush(); b.hidden = true; toast('Напоминания включены'); } catch (e) { toast(e.message); } finally { b.disabled = false; }
  });
  return b;
}

function registerSW() {
  if (!('serviceWorker' in navigator) || location.pathname.includes('/dev/')) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

function startApp() {
  document.body.classList.remove('signed-out');
  if (started) { show(); return; }
  started = true;
  const today = todayISO();
  top.innerHTML = '';
  top.append(renderSyncBadge(), renderBell(), createWeatherChip(today));
  onWeatherPicked((date, weather) =>
    store.upsert('settings', { user_id: user.id, day_date: date, day_weather: weather }).catch(() => {}));
  initDailyTheme(today);
  ensureSettings().catch(() => {});
  setTimeout(() => backfillStarterMoods().catch(() => {}), 3000);
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

// Вошла по ссылке, а пароля ещё нет — сначала предложим его придумать.
function enter(u) {
  user = u;
  if (needsPassword(u) && sessionStorage.getItem('pw-later') !== '1') {
    document.body.classList.add('signed-out');
    renderSetPassword(main, () => {
      try { sessionStorage.setItem('pw-later', '1'); } catch { /* ничего */ }
      startApp();
    });
  } else {
    startApp();
  }
}

hydrateIcons();
registerSW();
const { data: { session } } = await client.auth.getSession();
// после входа по ссылке в адресе остаётся #access_token=… — убираем
if (/access_token|error_description/.test(location.hash)) history.replaceState(null, '', location.pathname + '#/today');
if (session?.user) enter(session.user); else showAuth();

client.auth.onAuthStateChange((event, s) => {
  if (event === 'SIGNED_IN' && !user) enter(s.user);
  if (event === 'SIGNED_OUT') { user = null; showAuth(); }
});
