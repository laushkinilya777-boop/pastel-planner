// Постоянные UUID из строки-ключа: одинаковые на всех устройствах (нет дублей при синхронизации).
// FNV-1a, 4 прохода с разной «солью».
export function stableId(key) {
  const hex = [0, 1, 2, 3].map((salt) => {
    let h = 0x811c9dc5 ^ salt;
    for (const ch of `starter:${salt}:${key}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

