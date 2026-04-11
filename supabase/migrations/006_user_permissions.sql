-- PROJ-7: Granulare Feature-Berechtigungen
-- Tabelle user_permissions mit RLS, Trigger für automatische Erstellung

-- Tabelle erstellen
create table public.user_permissions (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  edit_transactions boolean not null default false,
  export_excel boolean not null default false,
  import_statements boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Index auf user_id (ist bereits PK, aber explizit für Joins)
-- PK-Index reicht aus, kein zusätzlicher Index nötig

-- Row Level Security aktivieren
alter table public.user_permissions enable row level security;

-- Policy: Benutzer liest eigene Berechtigungen
create policy "Benutzer liest eigene Berechtigungen"
  on public.user_permissions for select
  using (auth.uid() = user_id);

-- Policy: Admins lesen alle Berechtigungen
create policy "Admins lesen alle Berechtigungen"
  on public.user_permissions for select
  using (public.is_admin());

-- Policy: Admins aktualisieren Berechtigungen
create policy "Admins aktualisieren Berechtigungen"
  on public.user_permissions for update
  using (public.is_admin());

-- Policy: Admins erstellen Berechtigungen (für Trigger/Upsert via Admin-Client)
create policy "Admins erstellen Berechtigungen"
  on public.user_permissions for insert
  with check (public.is_admin());

-- Policy: Admins löschen Berechtigungen
create policy "Admins löschen Berechtigungen"
  on public.user_permissions for delete
  using (public.is_admin());

-- Trigger-Funktion: Automatisch user_permissions-Zeile erstellen
-- wenn ein neuer user_profiles-Eintrag angelegt wird
create or replace function public.handle_new_user_permissions()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.user_permissions (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Trigger auf user_profiles (nach INSERT)
create trigger on_user_profile_created
  after insert on public.user_profiles
  for each row execute function public.handle_new_user_permissions();

-- Bestehende Benutzer: Für alle user_profiles ohne user_permissions-Eintrag nachholen
insert into public.user_permissions (user_id)
select id from public.user_profiles
where id not in (select user_id from public.user_permissions);
