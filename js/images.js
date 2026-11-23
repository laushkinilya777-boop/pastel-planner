// Чистая логика картинок: размеры, картинка дня, градиенты фраз, проверка ссылок.

export function fitWithin(w, h, max = 1600) {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

// Картинка дня: одна и та же весь день; offset — нажатия «другая».
export function pickImageForDate(images, iso, offset = 0) {
  if (!images.length) return null;
  const sorted = [...images].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return sorted[(djb2(iso) + offset) % sorted.length];
}

const QUOTE_GRADIENTS = [
  'linear-gradient(135deg, #ffc4dc, #d9c6ff)',
  'linear-gradient(135deg, #ffd9c2, #ffc3d4)',
  'linear-gradient(135deg, #c8f0de, #c4dcff)',
  'linear-gradient(135deg, #d9c6ff, #c4dcff)',
  'linear-gradient(135deg, #fff0b8, #ffc9b5)',
  'linear-gradient(135deg, #c4ecff, #e9d4ff)',
];

export function quoteGradient(text) {
  return QUOTE_GRADIENTS[djb2(String(text)) % QUOTE_GRADIENTS.length];
}

export function isImageUrl(s) {
  try { return new URL(String(s).trim()).protocol === 'https:'; } catch { return false; }
}

export const CATEGORIES = [
  { id: 'cats', name: 'Котики' },
  { id: 'dogs', name: 'Собачки' },
  { id: 'motivation', name: 'Мотивация' },
  { id: 'mine', name: 'Мои' },
];
