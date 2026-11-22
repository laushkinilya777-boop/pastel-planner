// Красивые индикаторы прогресса: кольцо дня и «жидкая» капсула цели.
let uid = 0;
const clamp = (p) => Math.max(0, Math.min(100, Math.round(p)));

// Кольцо вокруг даты: доля выполненных задач за день.
export function dayRing(percent, size = 112) {
  const p = clamp(percent);
  const id = `ring${++uid}`;
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const a = (p / 100) * 2 * Math.PI - Math.PI / 2;
  const dotX = size / 2 + r * Math.cos(a);
  const dotY = size / 2 + r * Math.sin(a);
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--g1)"/><stop offset=".55" stop-color="var(--g2)"/><stop offset="1" stop-color="var(--g3)"/>
    </linearGradient></defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(143,111,240,.12)" stroke-width="3"/>
    <circle class="ring-arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="5"
      stroke-linecap="round" stroke-dasharray="${(c * p) / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    ${p > 0 && p < 100 ? `<circle cx="${dotX}" cy="${dotY}" r="6" fill="#fff" stroke="url(#${id})" stroke-width="2.5"/>` : ''}
  </svg>`;
}

// Стеклянная капсула с волной: прогресс цели.
export function liquidBar(percent) {
  const p = clamp(percent);
  const id = `liq${++uid}`;
  return `<div class="liquid" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100">
    <div class="liquid-fill" style="width:${p}%">
      <svg class="liquid-wave" viewBox="0 0 120 20" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="${id}" x1="0" x2="1">
          <stop offset="0" stop-color="var(--g1)"/><stop offset=".6" stop-color="var(--g2)"/><stop offset="1" stop-color="var(--g3)"/>
        </linearGradient></defs>
        <path d="M0 3 Q15 0 30 3 T60 3 T90 3 T120 3 V20 H0Z" fill="url(#${id})"/>
      </svg>
      <span class="liquid-shine"></span>
    </div>
    ${[...Array(9)].map((_, i) => `<i class="tick" style="left:${(i + 1) * 10}%"></i>`).join('')}
  </div>`;
}
