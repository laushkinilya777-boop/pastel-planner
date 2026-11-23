-- 005: ежедневная работа — перенос невыполненного и досоздание повторов.

-- Переносит невыполненные обычные задачи из прошлого на p_today.
create function public.rollover_tasks(p_user uuid, p_today date)
returns int language sql security definer set search_path = public as $$
  with moved as (
    update tasks
       set carry_count = carry_count + (p_today - date),
           date = p_today
     where user_id = p_user and not done and occurrence_date is null and date < p_today
    returning 1
  )
  select count(*)::int from moved
$$;
revoke execute on function public.rollover_tasks(uuid, date) from public, anon, authenticated;

-- Вызывается pg_cron (для всех) и сайтом при открытии (только для себя).
-- Срабатывает один раз в местные сутки, не раньше 00:05.
create function public.run_daily(p_now timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
declare
  s settings;
  local_now timestamp;
begin
  for s in select * from settings where auth.uid() is null or user_id = auth.uid() loop
    local_now := p_now at time zone s.tz;
    if s.last_rollover_date is distinct from local_now::date and local_now::time >= time '00:05' then
      perform rollover_tasks(s.user_id, local_now::date);
      perform materialize(s.user_id, local_now::date + 60);
      update settings set last_rollover_date = local_now::date where user_id = s.user_id;
    end if;
  end loop;
end $$;
revoke execute on function public.run_daily(timestamptz) from public, anon;
grant execute on function public.run_daily(timestamptz) to authenticated, service_role;
