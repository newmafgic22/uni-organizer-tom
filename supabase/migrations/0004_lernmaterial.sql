-- Etappe 4: KI-Lernmaterial
create table if not exists public.lernthemen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  titel text not null,
  status text not null default 'wartet' check (status in ('wartet', 'laeuft', 'fertig', 'fehler')),
  sofort boolean not null default false,
  klausur_am timestamptz,
  zusammenfassung text,
  katalog jsonb,      -- [{frage, antwort, afb}]
  aufgaben jsonb,     -- [{aufgabe, loesung, afb}]
  versuche int not null default 0,
  fehler text,
  created_at timestamptz not null default now(),
  gestartet_at timestamptz,
  fertig_at timestamptz,
  unique (user_id, material_id)
);

-- Selbsteinschätzung beim Abfragen (Grundlage für die spätere Lernanalyse)
create table if not exists public.antworten (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thema_id uuid not null references public.lernthemen(id) on delete cascade,
  art text not null check (art in ('katalog', 'aufgabe')),
  nr int not null,
  afb int,
  bewertung text not null check (bewertung in ('richtig', 'teilweise', 'falsch')),
  created_at timestamptz not null default now()
);
create index if not exists antworten_thema_idx on public.antworten (thema_id);

alter table public.lernthemen enable row level security;
alter table public.antworten enable row level security;
drop policy if exists "eigene Lernthemen" on public.lernthemen;
create policy "eigene Lernthemen" on public.lernthemen
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "eigene Antworten" on public.antworten;
create policy "eigene Antworten" on public.antworten
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.lernthemen, public.antworten to authenticated;
grant all on public.lernthemen, public.antworten to service_role;

-- Hat die Datei genug Text für Lernmaterial? (für den Knopf in der Materialliste)
alter table public.materials add column if not exists hat_text boolean
  generated always as (length(coalesce(inhalt, '')) > 500) stored;
