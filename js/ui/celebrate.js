// Похвала за галочку: всплывает карточка с весёлой картинкой и текстом.
import { store } from '../supabase.js';
import { imageSrc } from './image-tools.js';
import { renderQuoteCard } from './image-of-day.js';
import { pickMoodImage, cheerText } from '../mood.js';
import { todayISO } from '../dates.js';

let shown = null;
let count = 0;

export async function celebrate(progress) {
  shown?.remove();
  const images = await store.list('images');
  const card = document.createElement('div');
  card.className = `cheer${progress.done === progress.total ? ' all' : ''}`;
  card.setAttribute('role', 'status');
  const media = document.createElement('div');
  media.className = 'cheer-media';
  const img = images.length ? pickMoodImage(images, 'happy', todayISO(), (count += 1)) : null;
  if (img?.kind === 'quote' || !img) media.appendChild(renderQuoteCard(img?.text || 'Так держать!'));
  else {
    const el = new Image();
    el.alt = '';
    el.src = (await imageSrc(img)) || '';
    el.onerror = () => { media.innerHTML = ''; media.appendChild(renderQuoteCard('Так держать!')); };
    media.appendChild(el);
  }
  card.appendChild(media);
  card.insertAdjacentHTML('beforeend', `<p class="cheer-text"></p>`);
  card.querySelector('.cheer-text').textContent = cheerText(progress);
  card.addEventListener('click', () => card.remove());
  document.body.appendChild(card);
  shown = card;
  setTimeout(() => card.classList.add('out'), progress.done === progress.total ? 3200 : 2200);
  setTimeout(() => { card.remove(); if (shown === card) shown = null; }, progress.done === progress.total ? 3600 : 2600);
}
