-- Настроение картинок (весёлая / грустная). Вставь в Supabase → SQL Editor → Run. Один раз.

-- 009: настроение картинки — весёлая (за выполненное) или грустная (когда задачи ждут).
alter table public.images add column if not exists mood text check (mood in ('happy', 'sad'));
