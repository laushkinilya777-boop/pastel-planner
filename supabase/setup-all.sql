-- Всё для планера одним файлом (001–006). Вставь целиком в Supabase → SQL Editor → Run.
-- Собрано из supabase/migrations/. Запускать один раз.

-- ===== 001_schema.sql =====
-- 001: таблицы планера

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  period text not null check (period in ('week', 'month')),
  period_start date not null,
  title text not null,
  target int not null default 1 check (target > 0),
  manual_adjust int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  time time,
  note text,
  remind_minutes int,
  goal_id uuid references public.goals on delete set null,
  freq text not null check (freq in ('daily', 'weekdays', 'weekly', 'monthly', 'yearly')),
  weekdays int[] check (weekdays <@ array[1,2,3,4,5,6,7]),
  start_date date not null,
  end_date date,
  materialized_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  date date not null,
  time time,
  note text,
  done boolean not null default false,
  done_at timestamptz,
  carry_count int not null default 0,
  remind_minutes int,
  reminded_at timestamptz,
  goal_id uuid references public.goals on delete set null,
  recurrence_id uuid references public.recurrences on delete set null,
  occurrence_date date,
  is_exception boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recurrence_id, occurrence_date)
);
create index tasks_user_date on public.tasks (user_id, date);

create table public.task_history (
  id bigserial primary key,
  task_id uuid not null references public.tasks on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  changed_at timestamptz not null default now(),
  field text not null,
  old_value text,
  new_value text
);
create index task_history_task on public.task_history (task_id, changed_at);

create table public.special_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  title text not null,
  kind text not null default 'red' check (kind in ('red', 'deadline')),
  color text,
  yearly boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('photo', 'link', 'quote')),
  storage_path text,
  url text,
  text text,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  tz text not null default 'Europe/Moscow',
  day_date date,
  day_weather text check (day_weather in ('sunny', 'cloudy', 'rainy')),
  last_rollover_date date,
  updated_at timestamptz not null default now()
);

-- updated_at сам обновляется при любом изменении
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger touch before update on public.goals for each row execute function public.touch_updated_at();
create trigger touch before update on public.recurrences for each row execute function public.touch_updated_at();
create trigger touch before update on public.tasks for each row execute function public.touch_updated_at();
create trigger touch before update on public.special_dates for each row execute function public.touch_updated_at();
create trigger touch before update on public.images for each row execute function public.touch_updated_at();
create trigger touch before update on public.settings for each row execute function public.touch_updated_at();

-- ===== 002_rls.sql =====
-- 002: каждая строка видна и изменяема только её владельцу

do $$
declare t text;
begin
  foreach t in array array['goals', 'recurrences', 'tasks', 'task_history', 'special_dates', 'images', 'push_subscriptions', 'settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy owner_all on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant usage, select on sequence public.task_history_id_seq to authenticated;

-- ===== 003_history.sql =====
-- 003: история изменений задачи (название, дата, время, заметка).
-- Пишется триггером, поэтому её невозможно «забыть» записать из сайта.

create function public.log_task_changes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.title is distinct from old.title then
    insert into task_history (task_id, user_id, field, old_value, new_value) values (new.id, new.user_id, 'title', old.title, new.title);
  end if;
  if new.date is distinct from old.date then
    insert into task_history (task_id, user_id, field, old_value, new_value) values (new.id, new.user_id, 'date', old.date::text, new.date::text);
  end if;
  if new.time is distinct from old.time then
    insert into task_history (task_id, user_id, field, old_value, new_value) values (new.id, new.user_id, 'time', old.time::text, new.time::text);
  end if;
  if new.note is distinct from old.note then
    insert into task_history (task_id, user_id, field, old_value, new_value) values (new.id, new.user_id, 'note', old.note, new.note);
  end if;
  return new;
end $$;

create trigger tasks_history after update on public.tasks
  for each row execute function public.log_task_changes();

-- ===== 004_recurrence.sql =====
-- 004: повторяющиеся задачи.
-- Правило хранится в recurrences, конкретные дни заранее создаются обычными задачами в tasks.

-- Даты правила r в окне [p_from, p_to].
create function public.recurrence_dates(r public.recurrences, p_from date, p_to date)
returns setof date language sql immutable as $$
  with win as (
    select greatest(p_from, r.start_date) as a,
           least(p_to, coalesce(r.end_date, p_to)) as b
  )
  -- ежедневно / по дням недели / еженедельно
  select d::date from win, generate_series(win.a, win.b, interval '1 day') d
  where r.freq in ('daily', 'weekdays', 'weekly')
    and (r.freq <> 'weekdays' or extract(isodow from d)::int = any (r.weekdays))
    and (r.freq <> 'weekly'   or extract(isodow from d) = extract(isodow from r.start_date))
  union all
  -- ежемесячно / ежегодно: то же число, а если его нет — последний день месяца
  select x from (
    select least(
             make_date(extract(year from m)::int, extract(month from m)::int, 1)
               + (extract(day from r.start_date)::int - 1),
             (date_trunc('month', m) + interval '1 month - 1 day')::date
           ) as x
    from win, generate_series(date_trunc('month', r.start_date), date_trunc('month', win.b),
                              case r.freq when 'yearly' then interval '1 year' else interval '1 month' end) m
    where r.freq in ('monthly', 'yearly')
  ) s, win
  where x between win.a and win.b
  order by 1
$$;

-- Создаёт задачи по всем правилам пользователя до p_until. Возвращает число новых задач.
create function public.materialize(p_user uuid, p_until date)
returns int language plpgsql security definer set search_path = public as $$
declare
  r recurrences;
  n int := 0;
  k int;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    raise exception 'нельзя создавать задачи другому пользователю';
  end if;
  for r in select * from recurrences where user_id = p_user loop
    insert into tasks (user_id, title, date, time, note, remind_minutes, goal_id, recurrence_id, occurrence_date)
    select r.user_id, r.title, d, r.time, r.note, r.remind_minutes, r.goal_id, r.id, d
    from recurrence_dates(r, coalesce(r.materialized_until + 1, r.start_date), p_until) d
    on conflict (recurrence_id, occurrence_date) do nothing;
    get diagnostics k = row_count;
    n := n + k;
    update recurrences set materialized_until = greatest(coalesce(materialized_until, p_until), p_until)
      where id = r.id;
  end loop;
  return n;
end $$;
revoke execute on function public.materialize(uuid, date) from public, anon;
grant execute on function public.materialize(uuid, date) to authenticated, service_role;

-- «Эта и все следующие»: старое правило заканчивается накануне, с этого дня действует новое.
create function public.split_recurrence(p_task_id uuid, p_changes jsonb, p_until date default current_date + 60)
returns uuid language plpgsql set search_path = public as $$
declare
  t tasks;
  r recurrences;
  new_id uuid;
begin
  select * into t from tasks where id = p_task_id;
  if t.recurrence_id is null then raise exception 'задача не повторяющаяся'; end if;
  select * into r from recurrences where id = t.recurrence_id;

  update recurrences set end_date = t.occurrence_date - 1 where id = r.id;
  delete from tasks
    where recurrence_id = r.id and occurrence_date >= t.occurrence_date and not done and not is_exception;

  insert into recurrences (user_id, title, time, note, remind_minutes, goal_id, freq, weekdays, start_date, end_date)
  values (
    r.user_id,
    coalesce(p_changes->>'title', r.title),
    case when p_changes ? 'time' then (p_changes->>'time')::time else r.time end,
    case when p_changes ? 'note' then p_changes->>'note' else r.note end,
    case when p_changes ? 'remind_minutes' then (p_changes->>'remind_minutes')::int else r.remind_minutes end,
    case when p_changes ? 'goal_id' then (p_changes->>'goal_id')::uuid else r.goal_id end,
    coalesce(p_changes->>'freq', r.freq),
    case when p_changes ? 'weekdays'
         then array(select jsonb_array_elements_text(p_changes->'weekdays')::int) else r.weekdays end,
    t.occurrence_date,
    case when p_changes ? 'end_date' then (p_changes->>'end_date')::date else r.end_date end
  )
  returning id into new_id;

  perform materialize(r.user_id, p_until);
  return new_id;
end $$;
revoke execute on function public.split_recurrence(uuid, jsonb, date) from public, anon;
grant execute on function public.split_recurrence(uuid, jsonb, date) to authenticated;

-- «Удалить эту и все следующие».
create function public.end_recurrence_from(p_task_id uuid)
returns void language plpgsql set search_path = public as $$
declare t tasks;
begin
  select * into t from tasks where id = p_task_id;
  if t.recurrence_id is null then raise exception 'задача не повторяющаяся'; end if;
  update recurrences set end_date = t.occurrence_date - 1 where id = t.recurrence_id;
  delete from tasks
    where recurrence_id = t.recurrence_id and occurrence_date >= t.occurrence_date and not done and not is_exception;
end $$;
revoke execute on function public.end_recurrence_from(uuid) from public, anon;
grant execute on function public.end_recurrence_from(uuid) to authenticated;

-- ===== 005_daily.sql =====
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

-- ===== 006_reminders.sql =====
-- 006: какие напоминания пора отправить. Вызывает только Edge Function с service role.

create function public.due_reminders(p_now timestamptz)
returns table (task_id uuid, user_id uuid, title text, "time" time)
language sql stable security definer set search_path = public as $$
  select t.id, t.user_id, t.title, t.time
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

create function public.mark_reminded(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update tasks set reminded_at = now() where id = any (p_ids)
$$;
revoke execute on function public.mark_reminded(uuid[]) from public, anon, authenticated;
grant execute on function public.mark_reminded(uuid[]) to service_role;
