-- ============================================================
-- PROJ-4: Dashboard-Aggregationen (Performance-Fix)
-- Ersetzt clientseitige Berechnungen durch SQL-Aggregationen
-- ============================================================

-- 1. Verfügbare Jahre effizient abfragen (DISTINCT statt alle Zeilen laden)
CREATE OR REPLACE FUNCTION public.get_available_years()
RETURNS TABLE(year text)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT DISTINCT EXTRACT(YEAR FROM booking_date)::text AS year
  FROM public.transactions
  ORDER BY year DESC;
$$;

-- 2. Einnahmen/Ausgaben per SQL summieren (statt alle Beträge in den Speicher zu laden)
CREATE OR REPLACE FUNCTION public.get_transaction_sums(
  p_year int DEFAULT NULL,
  p_month int DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE(total_income numeric, total_expenses numeric)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS total_income,
    COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0) AS total_expenses
  FROM public.transactions
  WHERE
    (p_year IS NULL OR EXTRACT(YEAR FROM booking_date) = p_year)
    AND (p_month IS NULL OR EXTRACT(MONTH FROM booking_date) = p_month)
    AND (p_search IS NULL OR description ILIKE '%' || p_search || '%');
$$;
