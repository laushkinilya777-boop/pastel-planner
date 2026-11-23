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
