-- 007: расписание. Каждые 15 минут — перенос задач и повторы (run_daily сам срабатывает раз в сутки после 00:05),
-- каждую минуту — проверка напоминаний (вызов Edge Function «reminders»).
-- __PROJECT_URL__ и __CRON_SECRET__ подставляются в личном файле private/setup-reminders.sql (не в git).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('__CRON_SECRET__', 'reminders_cron_secret')
where not exists (select 1 from vault.secrets where name = 'reminders_cron_secret');

select cron.unschedule(jobname) from cron.job where jobname in ('planner-daily', 'planner-reminders');

select cron.schedule('planner-daily', '*/15 * * * *', $$ select public.run_daily() $$);

select cron.schedule('planner-reminders', '* * * * *', $$
  select net.http_post(
    url := '__PROJECT_URL__/functions/v1/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
$$);
