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
