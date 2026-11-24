// Текст push-напоминания. Тот же код вставлен в index.ts (функция в панели Supabase — один файл).
export function buildPayload({ task_id, title, time, remind_minutes, is_due }) {
  return {
    title,
    body: is_due
      ? `до ${String(time).slice(0, 5)} · осталось ${remind_minutes} мин`
      : `в ${String(time).slice(0, 5)} · через ${remind_minutes} мин`,
    url: './#/today',
    tag: task_id ? `task-${task_id}` : undefined,
  };
}
