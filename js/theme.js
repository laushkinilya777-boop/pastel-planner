// Тема дня по погоде: один раз в день сайт спрашивает «Какая сегодня погода?»,
// и выбранная тема держится до конца дня. В шаге 7 выбор ещё и синхронизируется через settings.
import { icon } from './ui/icons.js';

export const THEMES = [
  { id: 'opal', name: 'Опал' },
  { id: 'peach', name: 'Персиковый закат' },
  { id: 'mint', name: 'Мятное утро' },
];

export const WEATHER = [
  { id: 'sunny', name: 'Солнечно', icon: 'sun', theme: 'peach' },
  { id: 'cloudy', name: 'Облачно', icon: 'cloud', theme: 'opal' },
  { id: 'rainy', name: 'Дождь или снег', icon: 'rain', theme: 'mint' },
];

const KEY = 'planner-day'; // { date: 'YYYY-MM-DD', weather: 'sunny' | 'cloudy' | 'rainy' }

export function normalizeTheme(id) {
  return THEMES.some((t) => t.id === id) ? id : 'opal';
}

export const weatherById = (id) => WEATHER.find((w) => w.id === id) || null;

// Строка settings с сервера -> выбор дня, если он сделан сегодня (например, на другом устройстве).
export function dayFromSettings(row, today) {
  const w = row && row.day_date === today ? weatherById(row.day_weather) : null;
  return w ? { date: today, weather: w.id, theme: w.theme } : null;
}

export function needsDailyPick(saved, today) {
  return !saved || saved.date !== today || !weatherById(saved.weather);
}

export function applyTheme(id) {
  const theme = normalizeTheme(id);
  if (theme === 'opal') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
  const color = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  return theme;
}

export function loadDay() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}

function saveDay(day) {
  try { localStorage.setItem(KEY, JSON.stringify(day)); } catch { /* приватный режим */ }
}

let syncHook = null;
// app.js передаёт сюда функцию, которая сохраняет выбор в settings на сервере.
export function onWeatherPicked(fn) { syncHook = fn; }

// Выбор погоды на сегодня: сохраняет, применяет тему, сообщает подписчикам.
export function pickWeather(weatherId, today, { fromServer = false } = {}) {
  const w = weatherById(weatherId);
  saveDay({ date: today, weather: w.id, theme: w.theme });
  applyTheme(w.theme);
  document.dispatchEvent(new CustomEvent('daytheme', { detail: { date: today, weather: w.id } }));
  if (!fromServer) syncHook?.(today, w.id);
}

// Пришли настройки с сервера: если погоду сегодня уже выбрали на другом устройстве — применяем и закрываем вопрос.
export function applyServerDay(row, today) {
  const day = dayFromSettings(row, today);
  if (!day) return false;
  const local = loadDay();
  if (local?.date !== today || local.weather !== day.weather) pickWeather(day.weather, today, { fromServer: true });
  document.querySelectorAll('.weather-sheet').forEach((sh) => sh.closest('.sheet-backdrop')?.remove());
  return true;
}

// Окно «Какая сегодня погода?». Закрыть без выбора нельзя только при первом показе за день.
export function openWeatherSheet(today, { required = false } = {}) {
  const current = loadDay();
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  back.innerHTML = `
    <div class="sheet weather-sheet" role="dialog" aria-modal="true" aria-labelledby="wq">
      <h2 id="wq">Какая сегодня погода?</h2>
      <p class="sheet-sub">Оформление подстроится под неё и останется до конца дня</p>
      <div class="weather-list">
        ${WEATHER.map((w) => `
          <button class="weather-card ${w.theme}" data-w="${w.id}" aria-pressed="${current?.date === today && current.weather === w.id}">
            <span class="weather-ico">${icon(w.icon, 30)}</span>
            <span class="weather-name">${w.name}</span>
            <span class="weather-theme">${THEMES.find((t) => t.id === w.theme).name}</span>
          </button>`).join('')}
      </div>
      ${required ? '' : '<button class="btn ghost sheet-close">Оставить как есть</button>'}
    </div>`;
  const close = () => { back.classList.add('closing'); setTimeout(() => back.remove(), 250); };
  back.addEventListener('click', (e) => {
    const card = e.target.closest('[data-w]');
    if (card) { pickWeather(card.dataset.w, today); close(); return; }
    if (!required && (e.target === back || e.target.closest('.sheet-close'))) close();
  });
  document.body.appendChild(back);
  back.querySelector('[data-w]')?.focus();
}

// Плашка в шапке: погода дня; нажатие позволяет поменять выбор.
export function createWeatherChip(today) {
  const chip = document.createElement('button');
  chip.className = 'weather-chip';
  const paint = () => {
    const d = loadDay();
    const w = d && d.date === today ? weatherById(d.weather) : null;
    chip.innerHTML = w ? `${icon(w.icon, 18)}<span>${w.name}</span>` : `${icon('cloud', 18)}<span>Погода дня</span>`;
    chip.setAttribute('aria-label', w ? `Погода дня: ${w.name}. Изменить` : 'Выбрать погоду дня');
  };
  paint();
  chip.addEventListener('click', () => openWeatherSheet(today));
  document.addEventListener('daytheme', paint);
  return chip;
}

// Вызывается при открытии сайта: ставит тему дня и при необходимости спрашивает погоду.
export function initDailyTheme(today) {
  const d = loadDay();
  if (d?.theme) applyTheme(d.theme); // до выбора остаётся вчерашняя тема
  if (needsDailyPick(d, today)) openWeatherSheet(today, { required: true });
}
