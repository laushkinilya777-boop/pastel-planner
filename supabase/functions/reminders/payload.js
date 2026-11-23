// Текст push-напоминания. Тот же код вставлен в index.ts (функция в панели Supabase — один файл).
export function buildPayload({ task_id, title, time, remind_minutes }) {
  return {
    title,
    body: `в ${String(time).slice(0, 5)} · через ${remind_minutes} мин`,
    url: './#/today',
    tag: task_id ? `task-${task_id}` : undefined,
  };
}
