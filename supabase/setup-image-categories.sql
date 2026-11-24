-- Свои категории картинок. Вставь в Supabase → SQL Editor → Run. Один раз.

-- 013: свои категории картинок.
create table if not exists public.image_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  sort double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.image_categories enable row level security;
drop policy if exists owner_all on public.image_categories;
create policy owner_all on public.image_categories for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.image_categories to authenticated;
drop trigger if exists touch on public.image_categories;
create trigger touch before update on public.image_categories for each row execute function public.touch_updated_at();
