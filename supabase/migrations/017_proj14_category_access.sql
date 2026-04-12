-- PROJ-14: Kategoriebasierter Zugriff für Betrachter
-- Neue Tabelle user_category_access + SQL-Helferfunktionen + erweiterte
-- Aggregations-Funktionen für die Summary-API.
--
-- Grundregel:
--   Keine Zeilen für einen Benutzer → uneingeschränkter Zugriff (kein Filter)
--   Eine oder mehr Zeilen  → nur diese Kategorien sind für den Benutzer sichtbar
--   Admins erhalten serverseitig nie einen Filter (zusätzlich abgesichert)

-- =========================================================================
-- 1. Tabelle user_category_access
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.user_category_access (
  user_id     uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id)    ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_id)
);

-- Index auf user_id (Primärschlüssel deckt bereits den Prefix ab, aber wir
-- fügen einen separaten Index auf category_id hinzu, damit das Löschen einer
-- Kategorie effizient kaskadiert und spätere Reverse-Lookups performant sind).
CREATE INDEX IF NOT EXISTS idx_user_category_access_category_id
  ON public.user_category_access (category_id);

ALTER TABLE public.user_category_access ENABLE ROW LEVEL SECURITY;

-- Policy: Benutzer dürfen ihre eigenen Einträge lesen
CREATE POLICY "Benutzer lesen eigene Kategorie-Zugriffe"
  ON public.user_category_access FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins dürfen alle Einträge lesen
CREATE POLICY "Admins lesen alle Kategorie-Zugriffe"
  ON public.user_category_access FOR SELECT
  USING (public.is_admin());

-- Policy: Nur Admins dürfen anlegen
CREATE POLICY "Admins legen Kategorie-Zugriffe an"
  ON public.user_category_access FOR INSERT
  WITH CHECK (public.is_admin());

-- Policy: Nur Admins dürfen löschen
CREATE POLICY "Admins löschen Kategorie-Zugriffe"
  ON public.user_category_access FOR DELETE
  USING (public.is_admin());

-- =========================================================================
-- 2. Helper: Liste der erlaubten Kategorie-IDs für einen Benutzer
--    NULL-Rückgabe bedeutet "kein Filter" (Admin oder keine Einträge).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_user_allowed_category_ids(
  p_user_id uuid
)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_ids  uuid[];
BEGIN
  -- Admins haben nie einen Filter
  SELECT role INTO v_role
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF v_role = 'admin' THEN
    RETURN NULL;
  END IF;

  SELECT array_agg(category_id)
  INTO v_ids
  FROM public.user_category_access
  WHERE user_id = p_user_id;

  -- Keine Einträge → kein Filter (Standardfall)
  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_allowed_category_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_allowed_category_ids(uuid) TO authenticated;

-- =========================================================================
-- 3. Aktualisierte Aggregation: get_transaction_sums mit Kategorie-Filter
--    Wir überschreiben die bestehende Funktion (aus Migration 004) und fügen
--    den optionalen Parameter p_category_filter hinzu.
--
--    Verhalten:
--      p_category_filter IS NULL  → wie bisher (alle Buchungen)
--      p_category_filter = '{}'   → leere Menge: keine Buchungen sichtbar
--      sonst                      → nur Buchungen mit mind. einer dieser
--                                     Kategorien (unkategorisierte werden
--                                     ausgeschlossen)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_transaction_sums(
  p_year int DEFAULT NULL,
  p_month int DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_category_filter uuid[] DEFAULT NULL
)
RETURNS TABLE(total_income numeric, total_expenses numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS total_income,
    COALESCE(SUM(CASE WHEN t.amount < 0 THEN t.amount ELSE 0 END), 0) AS total_expenses
  FROM public.transactions t
  WHERE
    (p_year IS NULL OR EXTRACT(YEAR FROM t.booking_date) = p_year)
    AND (p_month IS NULL OR EXTRACT(MONTH FROM t.booking_date) = p_month)
    AND (p_search IS NULL OR t.description ILIKE '%' || p_search || '%')
    AND (
      p_category_filter IS NULL
      OR EXISTS (
        SELECT 1 FROM public.transaction_categories tc
        WHERE tc.transaction_id = t.id
          AND tc.category_id = ANY(p_category_filter)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_transaction_sums(int, int, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_transaction_sums(int, int, text, uuid[]) TO authenticated;

-- =========================================================================
-- 4. Gefilterter Kontostand:
--    Für eingeschränkte Betrachter darf der KPI-Kontostand NICHT der echte
--    Gesamtsaldo sein (würde die Einschränkung leaken). Stattdessen geben wir
--    den balance_after der letzten für den Benutzer SICHTBAREN Buchung zurück.
--
--    Für uneingeschränkte Benutzer (p_category_filter IS NULL) verhält sich
--    die Funktion wie die bisherige Abfrage: letzter Eintrag chronologisch.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_current_balance(
  p_category_filter uuid[] DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT t.balance_after
      FROM public.transactions t
      WHERE
        p_category_filter IS NULL
        OR EXISTS (
          SELECT 1 FROM public.transaction_categories tc
          WHERE tc.transaction_id = t.id
            AND tc.category_id = ANY(p_category_filter)
        )
      ORDER BY t.booking_date DESC, t.created_at DESC
      LIMIT 1
    ),
    0
  );
$$;

REVOKE ALL ON FUNCTION public.get_current_balance(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_balance(uuid[]) TO authenticated;
