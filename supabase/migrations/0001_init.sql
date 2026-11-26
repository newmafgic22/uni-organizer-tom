-- Uni-Organizer Tom: Etappe 1
-- Im Supabase-Dashboard unter "SQL Editor" einfuegen und "Run" klicken.

create table if not exists public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('ilias', 'portal2', 'sonstig')),
  url_encrypted text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  feed_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

alter table public.calendar_sources enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "eigene Quellen" on public.calendar_sources;
create policy "eigene Quellen" on public.calendar_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "eigene Einstellungen" on public.user_settings;
create policy "eigene Einstellungen" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
