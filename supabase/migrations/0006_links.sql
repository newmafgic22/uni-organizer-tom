-- Lerntools & Links: vom Sync gefundene ILIAS-Objekte (Tests, Übungen, Weblinks ...) und Links aus Material-Texten
create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  url text not null,
  titel text,
  quelle text not null default 'text',      -- 'ilias' (ILIAS-Objekt) oder 'text' (aus Datei-Inhalt)
  ilias_typ text,                           -- tst, exc, webr, lti ... (nur bei quelle = ilias)
  kategorie text not null default 'sonstiges',
  wichtig boolean not null default false,   -- echter Lernwert -> wird hervorgehoben
  fundstelle text,                          -- z. B. Dateiname der Folien
  gesehen boolean not null default false,
  ausgeblendet boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id, url)
);
create index if not exists links_course_idx on public.links (course_id);

-- Merker, ob der Text einer Datei schon nach Links durchsucht wurde (alte Dateien werden beim nächsten Sync nachgeholt)
alter table public.materials add column if not exists links_gescannt boolean not null default false;

alter table public.links enable row level security;
drop policy if exists "eigene Links" on public.links;
create policy "eigene Links" on public.links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.links to authenticated;
grant all on public.links to service_role;
