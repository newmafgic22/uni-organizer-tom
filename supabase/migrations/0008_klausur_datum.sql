-- Klausurtermin von Hand, für Klausuren, die nicht im Portal2-Kalender stehen (Portal2 gewinnt, wenn es den Termin kennt)
alter table public.courses add column if not exists klausur_datum date;
