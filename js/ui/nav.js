import { icon } from './icons.js';

const ITEMS = [
  { name: 'today', href: '#/today', icon: 'sun', label: 'Сегодня' },
  { name: 'week', href: '#/week', icon: 'week', label: 'Неделя' },
  { name: 'month', href: '#/month', icon: 'month', label: 'Месяц' },
  { name: 'images', href: '#/images', icon: 'gallery', label: 'Картинки' },
];

export function renderNav(nav, active) {
  const current = active === 'day' ? 'month' : active;
  nav.innerHTML = ITEMS.map((i) =>
    `<a href="${i.href}" class="${i.name === current ? 'active' : ''}" ${i.name === current ? 'aria-current="page"' : ''}>${icon(i.icon)}${i.label}</a>`,
  ).join('');
}
