// Нижний лист (на компьютере — окно по центру) и выбор из вариантов.
import { icon } from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function openSheet({ title, build, wide = false }) {
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  back.innerHTML = `
    <div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn sheet-x" type="button" aria-label="Закрыть">${icon('close', 20)}</button>
      </div>
      <div class="sheet-body"></div>
    </div>`;
  const prevFocus = document.activeElement;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    back.classList.add('closing');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => back.remove(), 230);
    prevFocus?.focus?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  back.querySelector('.sheet-x').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  build(back.querySelector('.sheet-body'), close);
  (back.querySelector('[autofocus]') || back.querySelector('.sheet-x')).focus();
  return { el: back, close };
}

// Вопрос с вариантами ответа. Возвращает value выбранного варианта или null.
export function choose({ title, text = '', options }) {
  return new Promise((resolve) => {
    let picked = null;
    const { el } = openSheet({
      title,
      build(body, close) {
        body.innerHTML = `${text ? `<p class="sheet-sub">${esc(text)}</p>` : ''}<div class="choice-list"></div>`;
        const list = body.querySelector('.choice-list');
        for (const o of options) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = `btn ${o.tone ?? 'ghost'} wide-btn`;
          b.textContent = o.label;
          b.addEventListener('click', () => { picked = o.value; close(); });
          list.appendChild(b);
        }
      },
    });
    new MutationObserver((_, obs) => { if (!el.isConnected) { obs.disconnect(); resolve(picked); } })
      .observe(document.body, { childList: true });
  });
}

// Короткое всплывающее сообщение внизу экрана.
export function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}
