// Работа с картинками в браузере: уменьшение фото, загрузка в хранилище, адрес для показа.
import { client } from '../supabase.js';
import { fitWithin } from '../images.js';

// Фото с iPhone (5–10 МБ) -> JPEG не больше 1600 px по длинной стороне.
export async function downscale(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const { w, h } = fitWithin(bmp.width, bmp.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не получилось обработать фото'))), 'image/jpeg', 0.85));
}

export async function uploadPhoto(file, userId) {
  if (!navigator.onLine) throw new Error('Чтобы загрузить фото, нужен интернет');
  const blob = await downscale(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await client.storage.from('images').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error('Не получилось загрузить фото. Попробуй ещё раз');
  return path;
}

export async function removePhoto(path) {
  if (path) await client.storage.from('images').remove([path]).catch(() => {});
}

// Временные ссылки на закрытые фото — с запасом на час, кэшируются в памяти.
const cache = new Map();
export async function imageSrc(image) {
  if (image.kind === 'link') return image.url;
  if (image.kind !== 'photo' || !image.storage_path) return null;
  const hit = cache.get(image.storage_path);
  if (hit && hit.until > Date.now()) return hit.url;
  const { data, error } = await client.storage.from('images').createSignedUrl(image.storage_path, 3600);
  if (error) return null;
  cache.set(image.storage_path, { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
