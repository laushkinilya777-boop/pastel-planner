-- Исправление повторов (смена правила, двойники). Вставь в Supabase → SQL Editor → Run. Один раз.

-- 011: исправления повторов (итоговая проверка).
-- C1: смена правила с weekdays = null больше не падает.
-- I1: «эта и все следующие» не создаёт двойников, «удалить эту и все следующие» убирает и будущие «только эта».

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

  insert into recurrences (user_id, title, time, note, remind_minutes, goal_id, freq, weekdays, start_date, end_date)
  values (
    r.user_id,
    coalesce(p_changes->>'title', r.title),
    case when p_changes ? 'time' then (p_changes->>'time')::time else r.time end,
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
revoke execute on function public.split_recurrence(uuid, jsonb, date) from public, anon;
grant execute on function public.split_recurrence(uuid, jsonb, date) to authenticated;

create or replace function public.end_recurrence_from(p_task_id uuid)
returns void language plpgsql set search_path = public as $$
declare t tasks;
begin
  select * into t from tasks where id = p_task_id;
  if t.recurrence_id is null then raise exception 'задача не повторяющаяся'; end if;
  update recurrences set end_date = t.occurrence_date - 1 where id = t.recurrence_id;
  delete from tasks
    where recurrence_id = t.recurrence_id and occurrence_date >= t.occurrence_date and not done;
end $$;
revoke execute on function public.end_recurrence_from(uuid) from public, anon;
grant execute on function public.end_recurrence_from(uuid) to authenticated;
