// Чистая логика задач: сортировка, метки, черновики, история, правила повтора.
import { formatShortDate, isoWeekday, parseISODate } from './dates.js';

export const DEFAULT_REMIND = 15;

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) =>
    (a.done - b.done)
    || ((a.time ? 0 : 1) - (b.time ? 0 : 1))
    || String(a.time || '').localeCompare(String(b.time || ''))
    || String(a.created_at || '').localeCompare(String(b.created_at || '')));
}

export function taskBadges(task, todayISO) {
  const out = [];
  if (task.carry_count > 0 && !task.occurrence_date) out.push('carried');
  if (task.occurrence_date && !task.done && task.date < todayISO) out.push('missed');
  if (task.recurrence_id) out.push('repeat');
  return out;
}

export function newTaskDraft({ date, time = null }) {
  return {
    title: '', date, time: time || null, note: null, done: false, done_at: null,
    carry_count: 0, remind_minutes: time ? DEFAULT_REMIND : null, goal_id: null,
  };
}

export function withTimeChange(task, time) {
  if (!time) return { ...task, time: null, remind_minutes: null };
  return { ...task, time, remind_minutes: task.remind_minutes ?? DEFAULT_REMIND };
}

export function dayProgress(tasks) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

const FIELD = { date: 'дата', time: 'время', title: 'название', note: 'заметка' };
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const pad = (n) => String(n).padStart(2, '0');

function showValue(field, v) {
  if (v == null || v === '') return 'нет';
  if (field === 'date') return formatShortDate(v);
  if (field === 'time') return v.slice(0, 5);
  return `«${v}»`;
}

export function historyLine(h) {
  const d = new Date(h.changed_at);
  const when = `${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${when} — ${FIELD[h.field] || h.field}: ${showValue(h.field, h.old_value)} → ${showValue(h.field, h.new_value)}`;
}

// Форма повтора -> поля для таблицы recurrences (или null, если повтора нет).
export function recurrenceRule(form, startDate) {
  if (!form || !form.repeat || form.repeat === 'none') return null;
  const weekdays = form.repeat === 'weekdays' ? [...(form.weekdays || [])].map(Number).sort((a, b) => a - b) : null;
  if (form.repeat === 'weekdays' && !weekdays.length) return null;
  return { freq: form.repeat, weekdays, start_date: startDate, end_date: form.until || null };
}

export function describeRule(r) {
  switch (r.freq) {
    case 'daily': return 'каждый день';
    case 'weekdays': return `по ${r.weekdays.map((d) => WD[d - 1]).join(', ')}`;
    case 'weekly': return `каждый ${WD[isoWeekday(r.start_date) - 1]}`;
    case 'monthly': return `каждый месяц, ${parseISODate(r.start_date).getDate()}-го`;
    case 'yearly': {
      const d = parseISODate(r.start_date);
      return `каждый год, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
    }
    default: return '';
  }
}
