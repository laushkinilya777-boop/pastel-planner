// Строка задачи в ленте дня.
import { icon } from './icons.js';
import { taskBadges, dueInfo } from '../tasks.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderTaskRow(task, { today, onToggle, onOpen }) {
  const row = document.createElement('div');
  row.className = `row${task.done ? ' done' : ''}`;
  const now = new Date();
  const due = dueInfo(task, today, `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  const dueTag = due ? `<span class="tag due${due.overdue ? ' overdue' : ''}">${icon('hourglass', 12)}${due.label}</span>` : '';
  const badges = dueTag + taskBadges(task, today).map((b) => {
    if (b === 'carried') return `<span class="tag">${icon('carried', 12)}перенесено${task.carry_count > 1 ? ` ×${task.carry_count}` : ''}</span>`;
    if (b === 'missed') return '<span class="tag missed">пропущено</span>';
    return `<span class="tag soft" title="Повторяется">${icon('repeat', 12)}</span>`;
  }).join('');
  row.innerHTML = `
    <span class="t">${task.time ? task.time.slice(0, 5) : ''}</span>
    <button class="check" type="button" aria-pressed="${task.done}" aria-label="${task.done ? 'Снять отметку' : 'Отметить выполненной'}: ${esc(task.title)}">
      ${task.done ? icon('check', 14) : ''}</button>
    <button class="title row-open" type="button">
      <span class="title-text">${esc(task.title)}</span>${badges}
      ${task.remind_minutes != null && (task.time || task.due_time) && !task.done ? `<span class="bell" title="Напоминание за ${task.remind_minutes} мин">${icon('bell', 13)}</span>` : ''}
      ${task.note ? `<span class="note">${esc(task.note)}</span>` : ''}
    </button>`;
  row.querySelector('.check').addEventListener('click', () => onToggle(task));
  row.querySelector('.row-open').addEventListener('click', () => onOpen(task));
  return row;
}
