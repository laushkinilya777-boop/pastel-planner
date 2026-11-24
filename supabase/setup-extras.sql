-- Новые разделы: «Сделать до», привычки, бюджет, идеи. Вставь в Supabase → SQL Editor → Run. Один раз.

-- 012: «Сделать до», привычки, бюджет, идеи для видео.

alter table public.tasks add column if not exists due_time time;

-- срок «до» у повторов
alter table public.recurrences add column if not exists due_time time;

create or replace function public.materialize(p_user uuid, p_until date)
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
    insert into tasks (user_id, title, date, time, due_time, note, remind_minutes, goal_id, recurrence_id, occurrence_date)
    select r.user_id, r.title, d, r.time, r.due_time, r.note, r.remind_minutes, r.goal_id, r.id, d
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

create or replace function public.split_recurrence(p_task_id uuid, p_changes jsonb, p_until date default current_date + 60)
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

  insert into recurrences (user_id, title, time, due_time, note, remind_minutes, goal_id, freq, weekdays, start_date, end_date)
  values (
    r.user_id,
    coalesce(p_changes->>'title', r.title),
    case when p_changes ? 'time' then (p_changes->>'time')::time else r.time end,
    case when p_changes ? 'due_time' then (p_changes->>'due_time')::time else r.due_time end,
    case when p_changes ? 'note' then p_changes->>'note' else r.note end,
    case when p_changes ? 'remind_minutes' then (p_changes->>'remind_minutes')::int else r.remind_minutes end,
    case when p_changes ? 'goal_id' then (p_changes->>'goal_id')::uuid else r.goal_id end,
    coalesce(p_changes->>'freq', r.freq),
    case when jsonb_typeof(p_changes->'weekdays') = 'array'
           then array(select jsonb_array_elements_text(p_changes->'weekdays')::int)
         when p_changes ? 'weekdays' then null
         else r.weekdays end,
    t.occurrence_date,
    case when p_changes ? 'end_date' then (p_changes->>'end_date')::date else r.end_date end
  )
  returning id into new_id;

  -- оставшиеся (выполненные и «только эта») переходят в новую серию — уникальный ключ не даст создать двойников
  update tasks set recurrence_id = new_id
    where recurrence_id = r.id and occurrence_date >= t.occurrence_date;

  perform materialize(r.user_id, p_until);
  return new_id;
end $$;


create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  color text not null default 'lilac',
  weekdays int[] check (weekdays <@ array[1,2,3,4,5,6,7]), -- null = каждый день
  archived boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id uuid not null references public.habits on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, date)
);

create table if not exists public.savings_jars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  target numeric(12, 2) check (target is null or target > 0),
  color text not null default 'peach',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.money_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  kind text not null check (kind in ('income', 'expense', 'save', 'withdraw')),
  amount numeric(12, 2) not null check (amount > 0),
  source text,   -- откуда (для дохода)
  target text,   -- куда (для расхода)
  jar_id uuid references public.savings_jars on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists money_entries_user_date on public.money_entries (user_id, date);

create table if not exists public.budget_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  month date not null, -- первое число месяца
  category text not null,
  kind text not null default 'expense' check (kind in ('expense', 'save')),
  planned numeric(12, 2) not null default 0 check (planned >= 0),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month, category)
);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  hook text,
  script text,
  link text,
  platform text not null default 'both' check (platform in ('reels', 'tiktok', 'both')),
  tags text[] not null default '{}',
  status text not null default 'idea' check (status in ('idea', 'script', 'shooting', 'published')),
  publish_date date,
  sort double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['habits', 'habit_logs', 'savings_jars', 'money_entries', 'budget_plans', 'ideas']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- до этой версии гость мог вызывать расчёт дат повторов (замечание M3)
revoke execute on function public.recurrence_dates(public.recurrences, date, date) from public, anon;

-- напоминание к сроку «до», если у задачи нет времени начала
drop function if exists public.due_reminders(timestamptz);
create function public.due_reminders(p_now timestamptz)
returns table (task_id uuid, user_id uuid, title text, "time" time, remind_minutes int)
language sql stable security definer set search_path = public as $$
  select t.id, t.user_id, t.title, coalesce(t.time, t.due_time), t.remind_minutes
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
