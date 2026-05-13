-- ============================================================
-- PROJ-17: RPC für Spender-Fuzzy-Suche (pg_trgm similarity)
--
-- Wird vom Endpoint /api/admin/spender/suggest verwendet, um beim
-- Öffnen des Quittungs-Erstellungs-Dialogs passende Spender anhand
-- des counterpart-Namens vorzuschlagen.
-- ============================================================

CREATE OR REPLACE FUNCTION public.spender_fuzzy_suche(
  p_name text,
  p_threshold real DEFAULT 0.4,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  name text,
  strasse text,
  plz text,
  ort text,
  email text,
  iban text,
  created_at timestamptz,
  updated_at timestamptz,
  similarity real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.strasse,
    s.plz,
    s.ort,
    s.email,
    s.iban,
    s.created_at,
    s.updated_at,
    similarity(s.name, p_name) AS similarity
  FROM public.spender s
  WHERE similarity(s.name, p_name) >= p_threshold
  ORDER BY similarity(s.name, p_name) DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.spender_fuzzy_suche(text, real, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.spender_fuzzy_suche(text, real, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spender_fuzzy_suche(text, real, integer) TO service_role;
