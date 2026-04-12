-- PROJ-12 Fix aus QA-Runde 1
-- BUG-005: Effizienter Uncategorized-Filter via SQL-Funktion

-- =========================================================================
-- BUG-005: SQL-Funktion für Uncategorized-Filter
--   Ersetzt die zweifache limit(100000)-Abfrage in src/app/api/transactions/route.ts
--   durch eine einzige DB-seitige WHERE-NOT-EXISTS-Abfrage.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.uncategorized_transaction_ids(
  p_year text DEFAULT NULL,
  p_month text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT t.id
  FROM public.transactions t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.transaction_categories tc
    WHERE tc.transaction_id = t.id
  )
    AND (p_year IS NULL OR t.booking_date >= make_date(p_year::int, 1, 1))
    AND (p_year IS NULL OR t.booking_date <= make_date(p_year::int, 12, 31))
    AND (
      p_month IS NULL
      OR p_year IS NULL
      OR EXTRACT(MONTH FROM t.booking_date)::int = p_month::int
    )
    AND (p_search IS NULL OR t.description ILIKE '%' || p_search || '%');
$$;

REVOKE ALL ON FUNCTION public.uncategorized_transaction_ids(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.uncategorized_transaction_ids(text, text, text) TO authenticated;
