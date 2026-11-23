// Рисует значки приложения (опаловый градиент + белое солнышко) без сторонних библиотек.
// Запуск: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 3 + 1)] = 0; rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const STOPS = [[0, hex('#9d86f7')], [0.6, hex('#e98bc0')], [1, hex('#ffb38f')]];
function grad(t) {
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i]; const [t0, c0] = STOPS[i - 1];
    if (t <= t1) { const k = (t - t0) / (t1 - t0); return c0.map((v, j) => v + (c1[j] - v) * k); }
  }
  return STOPS.at(-1)[1];
}
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
const RAYS = [[12, 2, 12, 4.5], [12, 19.5, 12, 22], [2, 12, 4.5, 12], [19.5, 12, 22, 12], [4.93, 4.93, 6.7, 6.7], [17.3, 17.3, 19.07, 19.07], [4.93, 19.07, 6.7, 17.3], [17.3, 6.7, 19.07, 4.93]];

function icon(size, pad) {
  const rgb = Buffer.alloc(size * size * 3);
  const s = (size - 2 * pad) / 24;
  const half = 1.7 / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let c = grad((x + y) / (2 * size));
      const glow = Math.max(0, 1 - Math.hypot(x - size * 0.3, y - size * 0.25) / (size * 0.7)) * 0.35;
      c = c.map((v) => v + (255 - v) * glow);
      // координаты в системе 24×24
      const u = (x + 0.5 - pad) / s, v = (y + 0.5 - pad) / s;
      let d = Math.abs(Math.hypot(u - 12, v - 12) - 4.2);
      for (const r of RAYS) d = Math.min(d, segDist(u, v, ...r));
      const a = Math.max(0, Math.min(1, (half - d) * s + 0.5)); // сглаживание по пикселю
      const o = (y * size + x) * 3;
      for (let j = 0; j < 3; j++) rgb[o + j] = Math.round(c[j] + (255 - c[j]) * a);
    }
  }
  return png(size, rgb);
}

mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
const out = (name, buf) => writeFileSync(new URL(`../icons/${name}`, import.meta.url), buf);
out('icon-192.png', icon(192, 42));
out('icon-512.png', icon(512, 112));
out('icon-maskable-512.png', icon(512, 150));
out('apple-touch-icon.png', icon(180, 40));
console.log('icons ok');
