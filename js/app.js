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

// Если раздел не загрузился (нет связи и он ещё не сохранён на устройстве) — понятное сообщение.
const offline = (title, ico) => (e) => {
  console.error(e);
  return placeholder(title, ico, 'Нет связи, а этот раздел ещё не сохранён на устройстве. Открой его, когда появится интернет');
};
const PAGES = {
  today: () => import('./pages/today.js').catch(offline('Сегодня', 'sun')),
  day: () => import('./pages/day.js').catch(offline('День', 'sun')),
  week: () => import('./pages/week.js').catch(offline('Неделя', 'week')),
  month: () => import('./pages/month.js').catch(offline('Месяц', 'month')),
  images: () => import('./pages/images.js').catch(offline('Картинки', 'gallery')),
};

const nav = document.getElementById('nav');
const main = document.getElementById('app');
const top = document.getElementById('top-bar');
let cleanup = null;
let user = null;

let shownDay = null; // какой день был «сегодня» при последней отрисовке
async function show() {
  shownDay = todayISO();
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
  cacheLoaded();
}

// Всё, что страница уже загрузила (свои модули и библиотеки), просим сохранить для запуска без интернета.
function cacheLoaded() {
  if (!('serviceWorker' in navigator) || location.pathname.includes('/dev/')) return;
  navigator.serviceWorker.ready.then((reg) => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name)
      .filter((u) => u.startsWith(location.origin) || u.startsWith('https://cdn.jsdelivr.net/') || u.startsWith('https://fonts.'));
    reg.active?.postMessage({ type: 'cache', urls: [location.href.split('#')[0], ...urls] });
  }).catch(() => {});
}

function startApp() {
  document.body.classList.remove('signed-out');
  if (started) { show(); return; }
  started = true;
  const today = todayISO();
  top.innerHTML = '';
  top.append(renderSyncBadge(), renderBell(), createWeatherChip(today));
  onWeatherPicked((date, weather) =>
    store.patch('settings', user.id, { day_date: date, day_weather: weather }).catch(() => {}));
  initDailyTheme(today);
  ensureSettings().catch(() => {});
  setTimeout(() => backfillStarterMoods().catch(() => {}), 3000);
  store.on('change', (table) => {
    if (table === 'settings') store.list('settings').then((rs) => applyServerDay(rs.find((r) => r.user_id === user.id), todayISO()));
  });
  dailyWork();
  // после полуночи (iPhone держит приложение в памяти) — перерисовать, чтобы «Сегодня» стало новым днём
  const dayCheck = () => { if (shownDay && shownDay !== todayISO()) show(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { dayCheck(); dailyWork(); } });
  setInterval(dayCheck, 60000);
  // заранее подгрузить все разделы, чтобы они открывались и без интернета
  setTimeout(() => Promise.allSettled(Object.values(PAGES).map((f) => f())).then(cacheLoaded), 5000);
  store.on('error', (e) => toast(`Не удалось сохранить изменение: ${e?.message || 'ошибка сервера'}`));
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
