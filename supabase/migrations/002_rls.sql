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
