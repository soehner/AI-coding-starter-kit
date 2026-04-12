-- PROJ-14 Bug-Fixes
--
-- BUG-1 (Kritisch): get_current_balance gab balance_after der letzten
-- sichtbaren Buchung zurück. Da balance_after in der DB den ECHTEN Kontostand
-- zum jeweiligen Zeitpunkt enthält (kumuliert über ALLE Transaktionen, auch
-- unsichtbare), konnte ein eingeschränkter Betrachter so den tatsächlichen
-- Vereinskontostand ermitteln. Der korrekte Wert für eingeschränkte Benutzer
-- ist die SUMME der Beträge ihrer sichtbaren Buchungen — der "virtuelle"
-- Saldo, der den realen Gesamtsaldo nicht preisgibt.
--
-- Zusätzlich: Neue Funktion get_opening_balance für den Excel-Export, die
-- denselben Leak im Eröffnungssaldo verhindert.

-- =========================================================================
-- get_current_balance: Fix für eingeschränkte Benutzer
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
  SELECT CASE
    WHEN p_category_filter IS NULL THEN
      -- Uneingeschränkt: echter Kontostand (balance_after der letzten Buchung)
      COALESCE(
        (
          SELECT t.balance_after
          FROM public.transactions t
          ORDER BY t.booking_date DESC, t.created_at DESC
          LIMIT 1
        ),
        0
      )
    ELSE
      -- Eingeschränkt: Summe der Beträge der SICHTBAREN Buchungen.
      -- Dies ist ein virtueller Saldo, der den realen Gesamtsaldo nicht
      -- preisgibt. Unkategorisierte Buchungen bleiben ausgeschlossen.
      COALESCE(
        (
          SELECT SUM(t.amount)
          FROM public.transactions t
          WHERE EXISTS (
            SELECT 1 FROM public.transaction_categories tc
            WHERE tc.transaction_id = t.id
              AND tc.category_id = ANY(p_category_filter)
          )
        ),
        0
      )
  END;
$$;

REVOKE ALL ON FUNCTION public.get_current_balance(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_balance(uuid[]) TO authenticated;

-- =========================================================================
-- get_opening_balance: Saldo zu Beginn eines Zeitraums (Excel-Export)
--
--   Uneingeschränkt (p_category_filter IS NULL)
--     → balance_after der letzten Buchung VOR p_before_date (bank-genau)
--
--   Eingeschränkt (p_category_filter = uuid[])
--     → SUM(amount) aller SICHTBAREN Buchungen VOR p_before_date
--       (virtuelle Summe, kein Leak)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_opening_balance(
  p_before_date date,
  p_category_filter uuid[] DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_category_filter IS NULL THEN
      COALESCE(
        (
          SELECT t.balance_after
          FROM public.transactions t
          WHERE t.booking_date < p_before_date
          ORDER BY t.booking_date DESC, t.id DESC
          LIMIT 1
        ),
        0
      )
    ELSE
      COALESCE(
        (
          SELECT SUM(t.amount)
          FROM public.transactions t
          WHERE t.booking_date < p_before_date
            AND EXISTS (
              SELECT 1 FROM public.transaction_categories tc
              WHERE tc.transaction_id = t.id
                AND tc.category_id = ANY(p_category_filter)
            )
        ),
        0
      )
  END;
$$;

REVOKE ALL ON FUNCTION public.get_opening_balance(date, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_opening_balance(date, uuid[]) TO authenticated;
