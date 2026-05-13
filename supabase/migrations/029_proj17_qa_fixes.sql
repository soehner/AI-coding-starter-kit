-- PROJ-17 QA-Fixes (BUG-3 + BUG-5)
--
-- BUG-5: next_spendenquittung_nummer() schuetzt sich jetzt mit einem
--        Advisory-Lock gegen parallele Aufrufe. Vorher konnten zwei
--        gleichzeitige Aufrufe dieselbe Nummer ermitteln; der UNIQUE-
--        Constraint fing das im INSERT ab, aber das PDF des Verlierers
--        war bereits im Storage gespeichert (Datenleiche).
--
-- BUG-3: RLS-Policy "Eingeloggte koennen Spendenquittungen lesen"
--        beruecksichtigt jetzt die PROJ-14-Kategorienzugriff-Einschraenkung.
--        Eingeschraenkte Betrachter sehen nur Quittungen, deren zugehoerige
--        Buchung mindestens einer ihrer erlaubten Kategorien zugeordnet ist.
--        Admins und uneingeschraenkte Benutzer sehen weiterhin alles.
--        Quittungen ohne Buchungsbezug (transaction_id = NULL) sind fuer
--        eingeschraenkte Betrachter nicht sichtbar - konsistent zur
--        Logik in PROJ-14 (unkategorisierte Buchungen sind unsichtbar).


-- ============================================================
-- BUG-5: Advisory-Lock in der Quittungs-Nummern-RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_spendenquittung_nummer()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_max_num integer;
  v_next_num integer;
BEGIN
  v_year := to_char(now(), 'YYYY');

  -- Transaktions-weiter Advisory Lock pro Jahr: parallele Aufrufe warten
  -- sequentiell aufeinander. Der Lock wird beim Commit/Rollback automatisch
  -- freigegeben.
  PERFORM pg_advisory_xact_lock(
    hashtext('spendenquittung_nummer_' || v_year)::bigint
  );

  -- Hoechste laufende Nummer fuer das aktuelle Jahr ermitteln.
  -- Erwartetes Format: SQ-JJJJ-NNNN
  SELECT COALESCE(
    MAX(
      CAST(
        substring(quittung_nummer FROM 'SQ-' || v_year || '-(\d+)$')
        AS integer
      )
    ),
    0
  )
  INTO v_max_num
  FROM public.spendenquittungen
  WHERE quittung_nummer LIKE 'SQ-' || v_year || '-%';

  v_next_num := v_max_num + 1;

  RETURN 'SQ-' || v_year || '-' || lpad(v_next_num::text, 4, '0');
END;
$$;


-- ============================================================
-- BUG-3: RLS-Policy fuer Spendenquittungen mit Kategorien-Filter
-- ============================================================

-- Alte permissive Policy entfernen
DROP POLICY IF EXISTS "Eingeloggte koennen Spendenquittungen lesen"
  ON public.spendenquittungen;

-- Neue Policy: Lesezugriff nur, wenn Admin, oder Benutzer uneingeschraenkt,
-- oder die zugehoerige Buchung in einer erlaubten Kategorie liegt.
CREATE POLICY "Spendenquittungen-Lesezugriff respektiert PROJ-14"
  ON public.spendenquittungen FOR SELECT
  USING (
    public.is_admin()
    OR (
      auth.uid() IS NOT NULL
      AND (
        -- Uneingeschraenkter Benutzer (kein Eintrag in user_category_access)
        public.get_user_allowed_category_ids(auth.uid()) IS NULL
        OR (
          -- Eingeschraenkter Benutzer: zugehoerige Buchung muss in
          -- mindestens einer erlaubten Kategorie liegen.
          transaction_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.transaction_categories tc
            WHERE tc.transaction_id = spendenquittungen.transaction_id
              AND tc.category_id = ANY(
                public.get_user_allowed_category_ids(auth.uid())
              )
          )
        )
      )
    )
  );

-- Hinweis: Index auf transaction_categories(transaction_id) existiert bereits
-- als idx_transaction_categories_transaction_id (Migration 011) und deckt die
-- EXISTS-Subquery der RLS-Policy ausreichend ab.
