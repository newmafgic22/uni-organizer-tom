-- Anzahl der Katalogfragen als eigene Spalte, damit Übersichten nicht alle Kataloge laden müssen
alter table public.lernthemen add column if not exists katalog_anzahl int
  generated always as (coalesce(jsonb_array_length(case when jsonb_typeof(katalog) = 'array' then katalog end), 0)) stored;
