-- PROJ-14 BUG-7 Fix
--
-- Die Summary-API lud bisher bis zu 10.000 Transaktionszeilen nur um
-- daraus per Set in JS DISTINCT-Jahre zu berechnen. Diese Funktion erledigt
-- das DISTINCT serverseitig und liefert nur wenige Zeilen zurück.
--
-- p_category_filter IS NULL  → alle Jahre (wie get_available_years)
-- p_category_filter = uuid[] → nur Jahre aus sichtbaren Buchungen
--                              (unkategorisierte ausgeschlossen)

CREATE OR REPLACE FUNCTION public.get_available_years_for_categories(
  p_category_filter uuid[] DEFAULT NULL
)
RETURNS TABLE(year text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT DISTINCT TO_CHAR(t.booking_date, 'YYYY') AS year
  FROM public.transactions t
  WHERE (
    p_category_filter IS NULL
    OR EXISTS (
      SELECT 1 FROM public.transaction_categories tc
      WHERE tc.transaction_id = t.id
        AND tc.category_id = ANY(p_category_filter)
    )
  )
  ORDER BY year DESC;
$$;

REVOKE ALL ON FUNCTION public.get_available_years_for_categories(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_years_for_categories(uuid[]) TO authenticated;
