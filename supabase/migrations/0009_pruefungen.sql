-- Prüfungsanmeldungen und Noten aus Portal2 (liest das Sync-Skript unter "Belegungen" und "Meine Leistungen")
create table if not exists public.pruefungen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nummer text not null,
  titel text not null,
  beginn timestamptz,
  ende timestamptz,
  raum text,
  form text,
  status text,
  versuch int,
  note numeric,
  ects numeric,
  freigabe text,
  angemeldet boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, nummer)
);
alter table public.pruefungen enable row level security;
drop policy if exists "eigene Prüfungen" on public.pruefungen;
create policy "eigene Prüfungen" on public.pruefungen
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.pruefungen to authenticated;
grant all on public.pruefungen to service_role;
