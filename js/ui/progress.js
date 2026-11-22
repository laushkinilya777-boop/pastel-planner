// Красивые индикаторы прогресса: кольцо дня и «жидкая» капсула цели.
// Цвета берутся из темы (--g1..--g3, --tint), поэтому всё в style, а не в атрибутах SVG.
let uid = 0;
export const clampPercent = (p) => Math.max(0, Math.min(100, Math.round(Number(p) || 0)));
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const frame = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => requestAnimationFrame(fn)) : fn());

function gradientDefs(id, vertical = false) {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="1">
    <stop offset="0" style="stop-color:var(--g1)"/><stop offset=".55" style="stop-color:var(--g2)"/><stop offset="1" style="stop-color:var(--g3)"/>
  </linearGradient></defs>`;
}

/* ───────── Кольцо дня ───────── */

// Возвращает элемент-кольцо; число/контент кладутся внутрь через children.
export function createDayRing(percent, size = 112) {
  const id = `ring${++uid}`;
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const el = document.createElement('div');
  el.className = 'day-badge';
  el.style.setProperty('--size', `${size}px`);
  el.innerHTML = `<svg class="ring" viewBox="0 0 ${size} ${size}" aria-hidden="true">${gradientDefs(id)}
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:rgba(var(--tint),.14)" stroke-width="3"/>
      <g transform="rotate(-90 ${size / 2} ${size / 2})">
        <circle class="ring-arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="5"
          stroke-linecap="round" stroke-dasharray="0 ${c}"/>
        <g class="ring-pearl" style="transform-origin:${size / 2}px ${size / 2}px">
          <circle cx="${size / 2 + r}" cy="${size / 2}" r="6" fill="#fff" stroke="url(#${id})" stroke-width="2.5"/>
        </g>
      </g>
    </svg>`;
  el._ring = { c, value: 0, target: percent };
  // первое значение ставим кадром позже, чтобы кольцо «наросло»; если до этого вызвали setDayRing — берём его значение
  frame(() => setDayRing(el, el._ring.target));
  return el;
}

export function setDayRing(el, percent) {
  const p = clampPercent(percent);
  el._ring.target = p;
  const { c } = el._ring;
  el.querySelector('.ring-arc').setAttribute('stroke-dasharray', `${(c * p) / 100} ${c}`);
  const pearl = el.querySelector('.ring-pearl');
  pearl.style.transform = `rotate(${(p / 100) * 360}deg)`;
  pearl.style.opacity = p > 0 && p < 100 ? 1 : 0;
  el.classList.toggle('complete', p === 100);
  if (p === 100 && el._ring.value < 100 && !reduced()) burst(el);
  el._ring.value = p;
}

/* ───────── Жидкая капсула ───────── */

// Вертикальная волна на переднем крае жидкости (повторяется 2 раза по высоте для бесшовной прокрутки).
const EDGE = 'M0 0 H6 C 12 5, 12 15, 6 20 S 0 35, 6 40 C 12 45, 12 55, 6 60 S 0 75, 6 80 H0 Z';

export function createLiquid(percent) {
  const el = document.createElement('div');
  el.className = 'liquid';
  el.setAttribute('role', 'progressbar');
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', '100');
  el.innerHTML = `
    <div class="liquid-fill">
      <svg class="liquid-edge back" viewBox="0 0 12 80" preserveAspectRatio="none" aria-hidden="true"><path d="${EDGE}"/></svg>
      <svg class="liquid-edge front" viewBox="0 0 12 80" preserveAspectRatio="none" aria-hidden="true"><path d="${EDGE}"/></svg>
      <span class="bubble" style="--x:18%;--d:3.2s;--delay:0s;--s:5px"></span>
      <span class="bubble" style="--x:42%;--d:2.6s;--delay:1.1s;--s:4px"></span>
      <span class="bubble" style="--x:66%;--d:3.6s;--delay:.5s;--s:6px"></span>
      <span class="bubble" style="--x:84%;--d:2.9s;--delay:1.8s;--s:3px"></span>
      <span class="liquid-shine"></span>
    </div>
    ${[...Array(9)].map((_, i) => `<i class="tick" style="left:${(i + 1) * 10}%"></i>`).join('')}
    <span class="liquid-label"></span>`;
  el._value = 0;
  el._target = percent;
  frame(() => setLiquid(el, el._target));
  return el;
}

export function setLiquid(el, percent) {
  const p = clampPercent(percent);
  el._target = p;
  const prev = el._value;
  el.querySelector('.liquid-fill').style.width = `${p}%`;
  el.setAttribute('aria-valuenow', String(p));
  const label = el.querySelector('.liquid-label');
  label.textContent = `${p}%`;
  label.style.left = `clamp(22px, ${p}%, calc(100% - 22px))`;
  el.classList.toggle('empty', p === 0);
  el.classList.toggle('complete', p === 100);
  if (p !== prev && !reduced()) {
    el.classList.remove('slosh');
    void el.offsetWidth; // перезапуск анимации всплеска
    el.classList.add('slosh');
    if (p === 100 && prev < 100) burst(el);
  }
  el._value = p;
}

/* ───────── Искры при 100% ───────── */

function burst(host) {
  const wrap = document.createElement('div');
  wrap.className = 'sparkles';
  for (let i = 0; i < 12; i++) {
    const s = document.createElement('i');
    const angle = (i / 12) * Math.PI * 2;
    const dist = 26 + (i % 3) * 10;
    s.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    s.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
    s.style.animationDelay = `${(i % 4) * 40}ms`;
    wrap.appendChild(s);
  }
  host.appendChild(wrap);
  setTimeout(() => wrap.remove(), 1200);
}
