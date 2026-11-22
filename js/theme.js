// Темы по настроению. Выбор хранится на устройстве; в шаге 7 он ещё и синхронизируется через settings.theme.
export const THEMES = [
  { id: 'opal', name: 'Опал' },
  { id: 'peach', name: 'Персиковый закат' },
  { id: 'mint', name: 'Мятное утро' },
];

const KEY = 'planner-theme';

export function normalizeTheme(id) {
  return THEMES.some((t) => t.id === id) ? id : 'opal';
}

export function applyTheme(id) {
  const theme = normalizeTheme(id);
  if (theme === 'opal') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
  const color = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  try { localStorage.setItem(KEY, theme); } catch { /* приватный режим — не страшно */ }
  return theme;
}

export function savedTheme() {
  try { return normalizeTheme(localStorage.getItem(KEY)); } catch { return 'opal'; }
}

// Кружки-переключатели. onChange(themeId) вызывается после смены.
export function createThemePicker(onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'themes';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', 'Тема оформления');
  const current = savedTheme();
  for (const t of THEMES) {
    const b = document.createElement('button');
    b.className = `theme-dot ${t.id}`;
    b.title = t.name;
    b.setAttribute('aria-label', t.name);
    b.setAttribute('aria-pressed', String(t.id === current));
    b.addEventListener('click', () => {
      applyTheme(t.id);
      wrap.querySelectorAll('.theme-dot').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onChange?.(t.id);
    });
    wrap.appendChild(b);
  }
  return wrap;
}
