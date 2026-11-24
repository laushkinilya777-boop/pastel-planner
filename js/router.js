// Адреса страниц: #/today, #/week, #/month, #/images, #/day/YYYY-MM-DD
const SIMPLE = new Set(['today', 'week', 'month', 'habits', 'budget', 'ideas', 'images']);

export function parseRoute(hash) {
  const parts = String(hash || '').replace(/^#\/?/, '').split('/');
  if (SIMPLE.has(parts[0])) return { name: parts[0], params: {} };
  if (parts[0] === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(parts[1] || '')) return { name: 'day', params: { date: parts[1] } };
  return { name: 'today', params: {} };
}
