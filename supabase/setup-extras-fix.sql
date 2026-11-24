-- Исправления новых разделов. Вставь в Supabase → SQL Editor → Run. Один раз.

-- 014: исправления после проверки новых разделов.
-- C1: порядок сортировки — большие числа (время создания).
alter table public.habits alter column sort type double precision;
alter table public.budget_plans alter column sort type double precision;

-- I1: месяцы, в которые план уже перенесён (чтобы удалённые строки не возвращались).
alter table public.settings add column if not exists plans_copied date[] not null default '{}';

-- текст напоминания «до 18:00» для задач только со сроком
drop function if exists public.due_reminders(timestamptz);
create function public.due_reminders(p_now timestamptz)
returns table (task_id uuid, user_id uuid, title text, "time" time, remind_minutes int, is_due boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.user_id, t.title, coalesce(t.time, t.due_time), t.remind_minutes, t.time is null
  from tasks t
  left join settings s on s.user_id = t.user_id
  where not t.done
    and coalesce(t.time, t.due_time) is not null
    and t.remind_minutes is not null
    and t.reminded_at is null
    and ((t.date + coalesce(t.time, t.due_time)) at time zone coalesce(s.tz, 'Europe/Moscow')) - make_interval(mins => t.remind_minutes)
        between p_now - interval '1 hour' + interval '1 microsecond' and p_now
  order by t.date, 4
$$;
revoke execute on function public.due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.due_reminders(timestamptz) to service_role;
