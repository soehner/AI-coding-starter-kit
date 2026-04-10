-- PROJ-2: Fehlende RLS-Policies fuer Benutzerverwaltung
-- INSERT- und DELETE-Policies auf user_profiles fuer Admin-Operationen

-- Policy: Admins koennen neue Profile einfuegen (fuer Einladungen via Service-Key)
-- Hinweis: Der Service-Role-Key umgeht RLS. Diese Policy ist eine zusaetzliche
-- Sicherheitsebene fuer den Fall, dass der Anon-Key verwendet wird.
CREATE POLICY "Admins fuegen Profile ein"
  ON public.user_profiles FOR INSERT
  WITH CHECK (public.is_admin());

-- Policy: Admins koennen Profile loeschen
CREATE POLICY "Admins loeschen Profile"
  ON public.user_profiles FOR DELETE
  USING (public.is_admin());

-- Trigger-Funktion anpassen: Rolle aus raw_user_meta_data uebernehmen
-- Wenn ein Admin einen Benutzer einlaedt, wird die Rolle in den Metadaten gespeichert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  user_count int;
  assigned_role text;
  meta_role text;
BEGIN
  -- Rolle aus den Einladungs-Metadaten lesen
  meta_role := new.raw_user_meta_data ->> 'role';

  IF meta_role IN ('admin', 'viewer') THEN
    assigned_role := meta_role;
  ELSE
    -- Fallback: Erster Benutzer = Admin, alle weiteren = Viewer
    SELECT count(*) INTO user_count FROM public.user_profiles;
    IF user_count = 0 THEN
      assigned_role := 'admin';
    ELSE
      assigned_role := 'viewer';
    END IF;
  END IF;

  INSERT INTO public.user_profiles (id, email, role)
  VALUES (new.id, new.email, assigned_role)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role;

  RETURN new;
END;
$$;
