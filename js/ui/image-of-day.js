// Картинка дня: одна на весь день, кнопка «другая» листает подборку.
import { store } from '../supabase.js';
import { imageSrc } from './image-tools.js';
import { icon } from './icons.js';
import { pickImageForDate, quoteGradient } from '../images.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const key = (iso) => `iod:${iso}`;
const getOffset = (iso) => { try { return Number(localStorage.getItem(key(iso))) || 0; } catch { return 0; } };
const setOffset = (iso, n) => { try { localStorage.setItem(key(iso), String(n)); } catch { /* ничего */ } };

export function renderQuoteCard(text) {
  const el = document.createElement('figure');
  el.className = 'quote-card';
  el.style.background = quoteGradient(text);
  el.innerHTML = `<blockquote>${esc(text)}</blockquote>`;
  return el;
}

export async function renderImageOfDay(root, iso) {
  const images = await store.list('images');
  root.innerHTML = '';
  if (!images.length) {
    root.innerHTML = `<a class="panel iod-empty" href="#/images">${icon('heart', 22)}<span>Добавь котиков, собачек и мотивацию в разделе «Картинки» — здесь появится картинка дня</span></a>`;
    return;
  }
  let offset = getOffset(iso);
  const card = document.createElement('section');
  card.className = 'iod';
  card.innerHTML = `<div class="iod-media"></div>
    <button class="iod-next" type="button" aria-label="Другая картинка">${icon('shuffle', 18)}<span>другая</span></button>`;
  root.appendChild(card);
  const media = card.querySelector('.iod-media');

  async function paint() {
    const img = pickImageForDate(images, iso, offset);
    media.innerHTML = '';
    if (img.kind === 'quote') { media.appendChild(renderQuoteCard(img.text)); return; }
    const src = await imageSrc(img);
    if (!src) { media.appendChild(renderQuoteCard('Сегодня — хороший день')); return; }
    const el = new Image();
    el.alt = img.text || 'Картинка дня';
    el.decoding = 'async';
    el.src = src;
    el.onerror = () => { media.innerHTML = ''; media.appendChild(renderQuoteCard('Картинка не загрузилась, но ты всё равно молодец')); };
    media.appendChild(el);
  }
  card.querySelector('.iod-next').addEventListener('click', () => { offset += 1; setOffset(iso, offset); paint(); });
  paint();
}
