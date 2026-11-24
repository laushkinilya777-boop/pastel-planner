// Идеи для Reels / TikTok: статусы-колонки, теги, публикации по датам.
export const STATUSES = [
  { id: 'idea', name: 'Идея', icon: 'idea' },
  { id: 'script', name: 'Сценарий', icon: 'edit' },
  { id: 'shooting', name: 'Снимаю', icon: 'gallery' },
  { id: 'published', name: 'Опубликовано', icon: 'check' },
];

export function shiftStatus(status, dir) {
  const i = STATUSES.findIndex((s) => s.id === status);
  return STATUSES[Math.max(0, Math.min(STATUSES.length - 1, i + dir))].id;
}

// В колонке: сначала с датой публикации (ближайшие выше), потом без даты — новые сверху.
export function byStatus(ideas) {
  const out = Object.fromEntries(STATUSES.map((s) => [s.id, []]));
  for (const i of ideas) (out[i.status] || out.idea).push(i);
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => {
      if (a.publish_date && b.publish_date) return a.publish_date.localeCompare(b.publish_date);
      if (a.publish_date) return -1;
      if (b.publish_date) return 1;
      return String(b.created_at).localeCompare(String(a.created_at));
    });
  }
  return out;
}

export function parseTags(s) {
  const seen = new Set();
  for (const t of String(s || '').split(/[\s,#]+/)) {
    const v = t.trim().toLowerCase();
    if (v) seen.add(v);
  }
  return [...seen];
}

export const ideasForDate = (ideas, iso) => ideas.filter((i) => i.publish_date === iso);

export const platformLabel = (p) => ({ reels: 'Reels', tiktok: 'TikTok', both: 'Reels + TikTok' }[p] || 'Reels + TikTok');
