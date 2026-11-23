-- 009: настроение картинки — весёлая (за выполненное) или грустная (когда задачи ждут).
alter table public.images add column if not exists mood text check (mood in ('happy', 'sad'));
