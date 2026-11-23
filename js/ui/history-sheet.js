// История изменений одной задачи.
import { store } from '../supabase.js';
import { openSheet } from './sheet.js';
import { historyLine } from '../tasks.js';

export function openHistory(task) {
  openSheet({
    title: 'История изменений',
    build: async (body) => {
      body.innerHTML = '<p class="sheet-sub">Загружаем…</p>';
      await store.refresh('task_history').catch(() => {});
      const rows = (await store.list('task_history', (h) => h.task_id === task.id))
        .sort((a, b) => String(b.changed_at).localeCompare(String(a.changed_at)));
      body.innerHTML = rows.length
        ? `<ol class="history">${rows.map((h) => `<li>${historyLine(h).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</li>`).join('')}</ol>`
        : '<p class="sheet-sub">Пока без изменений: задачу ещё не переносили и не правили</p>';
    },
  });
}
