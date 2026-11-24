// Меню: на компьютере все разделы сбоку; на телефоне 4 раздела + «Ещё» (Бюджет, Идеи, Картинки).
import { icon } from './icons.js';
import { openSheet } from './sheet.js';
import { NAV_ITEMS, MAIN_ON_PHONE } from '../nav-items.js';

export function renderNav(nav, active) {
  const current = active === 'day' ? 'month' : active;
  const extra = NAV_ITEMS.filter((i) => !MAIN_ON_PHONE.includes(i.name));
  const extraActive = extra.find((i) => i.name === current);
  nav.innerHTML = NAV_ITEMS.map((i) =>
    `<a href="${i.href}" class="${i.name === current ? 'active' : ''}${MAIN_ON_PHONE.includes(i.name) ? '' : ' nav-extra'}" ${i.name === current ? 'aria-current="page"' : ''}>${icon(i.icon)}${i.label}</a>`,
  ).join('')
    + `<button type="button" class="nav-more${extraActive ? ' active' : ''}" aria-label="Ещё разделы">${icon(extraActive ? extraActive.icon : 'more')}${extraActive ? extraActive.label : 'Ещё'}</button>`;
  nav.querySelector('.nav-more').addEventListener('click', () => {
    openSheet({
      title: 'Ещё',
      build(body, close) {
        body.innerHTML = `<div class="more-grid">${extra.map((i) =>
          `<a href="${i.href}" class="more-item${i.name === current ? ' active' : ''}">${icon(i.icon, 26)}<span>${i.label}</span></a>`).join('')}</div>`;
        body.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
      },
    });
  });
}
