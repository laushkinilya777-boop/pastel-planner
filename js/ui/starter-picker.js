// Окно «Стартовый набор»: отмечаешь понравившиеся фото и фразы — они добавляются в подборку.
import { store } from '../supabase.js';
import { openSheet, toast } from './sheet.js';
import { renderQuoteCard } from './image-of-day.js';
import { icon } from './icons.js';
import { STARTER, STARTER_GROUPS, starterId, starterRow } from '../starter.js';

export async function openStarterPicker() {
  const have = new Set((await store.list('images')).map((i) => i.id));
  const picked = new Set();
  openSheet({
    title: 'Стартовый набор',
    wide: true,
    build(body, close) {
      body.innerHTML = `
        <p class="sheet-sub">Нажимай на картинки и фразы, которые нравятся. Фото — с Unsplash, их можно использовать бесплатно</p>
        <div class="starter"></div>
        <div class="starter-foot">
          <button class="btn wide-btn" type="button" disabled>${icon('check', 18)}<span>Выбери картинки</span></button>
        </div>`;
      const box = body.querySelector('.starter');
      const btn = body.querySelector('.starter-foot .btn');
      const paintBtn = () => {
        btn.disabled = picked.size === 0;
        btn.querySelector('span').textContent = picked.size ? `Добавить выбранные: ${picked.size}` : 'Выбери картинки';
      };
      for (const g of STARTER_GROUPS) {
        const items = STARTER.filter((s) => s.group === g.id);
        const sec = document.createElement('section');
        sec.innerHTML = `<h3 class="starter-h">${g.name}</h3><div class="starter-grid ${g.id === 'quotes' ? 'quotes' : ''}"></div>`;
        const grid = sec.querySelector('.starter-grid');
        for (const it of items) {
          const id = starterId(it.key);
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'pick';
          const already = have.has(id);
          b.disabled = already;
          b.setAttribute('aria-pressed', 'false');
          if (it.kind === 'quote') b.appendChild(renderQuoteCard(it.text));
          else {
            const img = new Image();
            img.loading = 'lazy';
            img.alt = g.name;
            img.src = it.url.replace('w=1080', 'w=400');
            b.appendChild(img);
          }
          b.insertAdjacentHTML('beforeend', `<span class="pick-mark">${already ? 'уже есть' : icon('check', 16)}</span>`);
          b.addEventListener('click', () => {
            if (picked.has(it)) picked.delete(it); else picked.add(it);
            b.setAttribute('aria-pressed', String(picked.has(it)));
            paintBtn();
          });
          grid.appendChild(b);
        }
        box.appendChild(sec);
      }
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        for (const it of picked) await store.upsert('images', { ...starterRow(it), created_at: new Date().toISOString() });
        toast(`Добавлено: ${picked.size}`);
        close();
      });
    },
  });
}
