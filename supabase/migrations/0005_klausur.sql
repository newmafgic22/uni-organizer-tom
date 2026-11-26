-- Klausur-Anpassung: Infos zur Klausur je Kurs, automatisches Einreihen neuer Vorlesungen
alter table public.courses add column if not exists klausur_info text;
alter table public.courses add column if not exists auto_einreihen boolean not null default false;
