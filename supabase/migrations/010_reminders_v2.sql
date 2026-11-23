-- 010: due_reminders отдаёт ещё и remind_minutes (для текста «через 15 мин»).
drop function if exists public.due_reminders(timestamptz);

create function public.due_reminders(p_now timestamptz)
returns table (task_id uuid, user_id uuid, title text, "time" time, remind_minutes int)
language sql stable security definer set search_path = public as $$
  select t.id, t.user_id, t.title, t.time, t.remind_minutes
  from tasks t
  left join settings s on s.user_id = t.user_id
  where not t.done
    and t.time is not null
    and t.remind_minutes is not null
    and t.reminded_at is null
    and ((t.date + t.time) at time zone coalesce(s.tz, 'Europe/Moscow')) - make_interval(mins => t.remind_minutes)
        between p_now - interval '1 hour' + interval '1 microsecond' and p_now
  order by t.date, t.time
$$;
revoke execute on function public.due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.due_reminders(timestamptz) to service_role;
