-- Neue Supabase-Projekte geben public-Tabellen nicht automatisch frei.
grant select, insert, update, delete on public.calendar_sources, public.user_settings to authenticated;
grant all on public.calendar_sources, public.user_settings to service_role;
