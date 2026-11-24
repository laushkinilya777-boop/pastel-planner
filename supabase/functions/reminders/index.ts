// Edge Function «reminders»: раз в минуту её вызывает pg_cron.
// Находит задачи, о которых пора напомнить, и шлёт push на все устройства хозяйки.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

// тот же текст, что в payload.js (там он покрыт тестами)
function buildPayload({ task_id, title, time, remind_minutes, is_due }: { task_id?: string; title: string; time: string; remind_minutes: number; is_due?: boolean }) {
  return {
    title,
    body: is_due
      ? `до ${String(time).slice(0, 5)} · осталось ${remind_minutes} мин`
      : `в ${String(time).slice(0, 5)} · через ${remind_minutes} мин`,
    url: './#/today',
    tag: task_id ? `task-${task_id}` : undefined,
  };
}

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`нет секрета ${k}`);
  return v;
};

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== env('CRON_SECRET')) return new Response('forbidden', { status: 403 });

  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

  const { data: due, error } = await db.rpc('due_reminders', { p_now: new Date().toISOString() });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!due?.length) return Response.json({ due: 0, sent: 0 });

  const users = [...new Set(due.map((d: { user_id: string }) => d.user_id))];
  const { data: subs } = await db.from('push_subscriptions').select('*').in('user_id', users);

  let sent = 0;
  const dead: string[] = [];
  for (const d of due) {
    for (const s of (subs || []).filter((x: { user_id: string }) => x.user_id === d.user_id)) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(buildPayload(d)),
          { TTL: 3600, urgency: 'high' },
        );
        sent += 1;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id); // устройство отписалось
      }
    }
  }
  if (dead.length) await db.from('push_subscriptions').delete().in('id', dead);
  await db.rpc('mark_reminded', { p_ids: due.map((d: { task_id: string }) => d.task_id) });
  return Response.json({ due: due.length, sent });
});
