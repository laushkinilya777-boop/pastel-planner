// Картинки по настроению: весёлая за выполненное, грустная — когда задачи ждут.
import { pickImageForDate } from './images.js';

export const EVENING_HOUR = 20;

// 'happy' | 'sad' | null (обычный день)
export function dayMood(tasks, today, now = new Date()) {
  const list = tasks.filter((t) => t.date === today);
  if (!list.length) return null;
  const open = list.filter((t) => !t.done);
  if (!open.length) return 'happy';
  if (open.some((t) => t.carry_count > 0)) return 'sad';
  if (now.getHours() >= EVENING_HOUR) return 'sad';
  return null;
}

// Картинка под настроение; если подходящих нет — любая. В обычный день грустные не показываем.
export function pickMoodImage(images, mood, iso, offset = 0) {
  const pool = mood
    ? images.filter((i) => i.mood === mood)
    : images.filter((i) => i.mood !== 'sad');
  return pickImageForDate(pool.length ? pool : images, `${iso}:${mood || ''}`, offset);
}

function plural(n, one, few, many) {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

export function cheerText({ done, total }) {
  const left = total - done;
  if (left <= 0) return 'Всё сделано! Ты умница';
  return `Молодец! ${plural(left, 'Осталась', 'Осталось', 'Осталось')} ${left} ${plural(left, 'задача', 'задачи', 'задач')}`;
}
