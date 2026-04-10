-- PROJ-1: Authentifizierung & Benutzerverwaltung
-- Tabelle user_profiles mit RLS und automatischer Profil-Erstellung

-- Tabelle erstellen
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

-- Indizes
create index idx_user_profiles_role on public.user_profiles(role);
create index idx_user_profiles_email on public.user_profiles(email);

-- Row Level Security aktivieren
alter table public.user_profiles enable row level security;

-- Policy: Benutzer sieht eigenes Profil
create policy "Benutzer sieht eigenes Profil"
  on public.user_profiles for select
  using (auth.uid() = id);

-- Policy: Admins sehen alle Profile (fuer PROJ-2 Benutzerverwaltung)
create policy "Admins sehen alle Profile"
  on public.user_profiles for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Policy: Admins koennen Profile aktualisieren (fuer PROJ-2 Rollenverwaltung)
create policy "Admins aktualisieren Profile"
  on public.user_profiles for update
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Trigger-Funktion: Automatisch Profil anlegen bei neuem Auth-Benutzer
-- Erster Benutzer wird Admin, alle weiteren Viewer
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  user_count int;
  assigned_role text;
begin
  select count(*) into user_count from public.user_profiles;

  if user_count = 0 then
    assigned_role := 'admin';
  else
    assigned_role := 'viewer';
  end if;

  insert into public.user_profiles (id, email, role)
  values (new.id, new.email, assigned_role);

  return new;
end;
$$;

-- Trigger auf auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
