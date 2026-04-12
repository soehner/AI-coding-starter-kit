-- PROJ-12 BUG-001 Fix: RLS-Policies auf transaction_categories so anpassen,
-- dass Betrachter mit der Feature-Berechtigung `edit_transactions` ebenfalls
-- Kategorien zuweisen und entfernen dürfen. Bisher waren INSERT/DELETE auf
-- reine Admins beschränkt, was dem Akzeptanzkriterium aus PROJ-12 widerspricht
-- und das Berechtigungsmodell aus PROJ-7 aushebelt.

-- Hilfsfunktion: darf der aktuelle Benutzer Buchungen bearbeiten?
-- Admins haben implizit alle Rechte; Betrachter benötigen den expliziten
-- Eintrag `edit_transactions = true` in `user_permissions`.
CREATE OR REPLACE FUNCTION public.can_edit_transactions()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.edit_transactions = true
    );
$$;

REVOKE ALL ON FUNCTION public.can_edit_transactions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_transactions() TO authenticated;

-- Bestehende Admin-only-Policies auf transaction_categories durch die
-- erweiterte Berechtigungsprüfung ersetzen.
DROP POLICY IF EXISTS "Admins legen Zuordnungen an" ON public.transaction_categories;
DROP POLICY IF EXISTS "Admins löschen Zuordnungen" ON public.transaction_categories;

CREATE POLICY "Editoren legen Zuordnungen an"
  ON public.transaction_categories FOR INSERT
  WITH CHECK (public.can_edit_transactions());

CREATE POLICY "Editoren löschen Zuordnungen"
  ON public.transaction_categories FOR DELETE
  USING (public.can_edit_transactions());
