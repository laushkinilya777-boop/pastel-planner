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
grant execute on function public.materialize(uuid, date) to authenticated;

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
grant execute on function public.end_recurrence_from(uuid) to authenticated;
