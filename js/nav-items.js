// Разделы меню по порядку (картинки — последние).
export const NAV_ITEMS = [
  { name: 'today', href: '#/today', icon: 'sun', label: 'Сегодня' },
  { name: 'week', href: '#/week', icon: 'week', label: 'Неделя' },
  { name: 'month', href: '#/month', icon: 'month', label: 'Месяц' },
  { name: 'habits', href: '#/habits', icon: 'habit', label: 'Привычки' },
  { name: 'budget', href: '#/budget', icon: 'wallet', label: 'Бюджет' },
  { name: 'ideas', href: '#/ideas', icon: 'idea', label: 'Идеи' },
  { name: 'images', href: '#/images', icon: 'gallery', label: 'Картинки' },
];

// На телефоне в нижней панели помещается 5 кнопок: 4 раздела + «Ещё».
export const MAIN_ON_PHONE = ['today', 'week', 'month', 'habits'];
