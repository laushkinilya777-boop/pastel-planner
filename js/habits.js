// Привычки: запланированные дни, серии 🔥, состояния по дням недели и месяца.
import { addDays, isoWeekday, weekDays } from './dates.js';

export const HABIT_COLORS = [
  { id: 'lilac', name: 'Сирень', fill: '#a993e8', soft: '#e4dbff' },
  { id: 'rose', name: 'Роза', fill: '#ef86b1', soft: '#fbd5e3' },
  { id: 'peach', name: 'Персик', fill: '#f7a07c', soft: '#ffe1d2' },
  { id: 'mint', name: 'Мята', fill: '#4fc9a8', soft: '#d2f0e3' },
  { id: 'sky', name: 'Небо', fill: '#6fa8ea', soft: '#d5e1fb' },
];
export const habitColor = (id) => HABIT_COLORS.find((c) => c.id === id) || HABIT_COLORS[0];

export const isDue = (habit, iso) => !habit.weekdays?.length || habit.weekdays.includes(isoWeekday(iso));

const doneSet = (habit, logs) => new Set(logs.filter((l) => l.habit_id === habit.id).map((l) => l.date));

// Подряд выполненные запланированные дни. Сегодня, пока не отмечено, серию не рвёт.
export function streak(habit, logs, today) {
  const done = doneSet(habit, logs);
  let day = today;
  if (!done.has(today)) day = addDays(today, -1);
  let n = 0;
  for (let guard = 0; guard < 1000; guard++, day = addDays(day, -1)) {
    if (!isDue(habit, day)) continue;
    if (!done.has(day)) break;
    n++;
  }
  return n;
}

function state(habit, done, day, today) {
  if (!isDue(habit, day)) return 'off';
  if (habit.created_at && day < String(habit.created_at).slice(0, 10) && !done.has(day)) return 'off'; // привычки ещё не было
  if (done.has(day)) return 'done';
  return day < today ? 'missed' : 'todo';
}

export function weekStates(habit, logs, weekStartISO, today) {
  const done = doneSet(habit, logs);
  return weekDays(weekStartISO).map((d) => state(habit, done, d, today));
}

export function monthStates(habit, logs, year, month, today) {
  const done = doneSet(habit, logs);
  const days = new Date(year, month, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    return { date, state: state(habit, done, date, today) };
  });
}

export const todayHabits = (habits, today) => habits.filter((h) => !h.archived && isDue(h, today));
