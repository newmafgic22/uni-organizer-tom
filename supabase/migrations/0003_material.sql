-- Etappe 2: ILIAS-Materialien
alter table public.user_settings add column if not exists sync_token uuid not null default gen_random_uuid() unique;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ilias_ref text not null,            -- z. B. crs/1730221 oder grp/1746632
  name text not null,
  ausgeblendet boolean not null default false,
  zuletzt_sync timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, ilias_ref)
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  ilias_id text not null,             -- ILIAS-Datei-ID
  version text not null default '',   -- Änderungsstand (Datum/Version aus ILIAS)
  ordner text not null default '',    -- Pfad im Kurs, z. B. "Vorlesung/Woche 3"
  dateiname text not null,
  groesse bigint,
  storage_path text not null,
  inhalt text,                        -- extrahierter Text (für Suche und KI)
  such tsvector generated always as (
    to_tsvector('german', coalesce(dateiname, '') || ' ' || coalesce(ordner, '') || ' ' || coalesce(inhalt, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ilias_id)
);
create index if not exists materials_such_idx on public.materials using gin (such);
create index if not exists materials_course_idx on public.materials (course_id);

alter table public.courses enable row level security;
alter table public.materials enable row level security;

drop policy if exists "eigene Kurse" on public.courses;
create policy "eigene Kurse" on public.courses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "eigene Materialien" on public.materials;
create policy "eigene Materialien" on public.materials
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.courses, public.materials to authenticated;
grant all on public.courses, public.materials to service_role;

-- Privater Speicher für die Dateien (max. 50 MB je Datei im Free-Tarif)
insert into storage.buckets (id, name, public)
values ('materialien', 'materialien', false)
on conflict (id) do nothing;
