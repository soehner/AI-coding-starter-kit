-- ============================================================
-- PROJ-13 BUG-007: Atomarer Insert mit nächstem sort_order
--
-- Grund: Die API-Route POST /api/admin/categorization-rules hat bisher
-- den nächsten sort_order in einem separaten SELECT-Query ermittelt und
-- dann in einem zweiten INSERT-Query geschrieben. Bei zwei parallel
-- laufenden POST-Requests konnten so zwei Regeln mit demselben
-- sort_order angelegt werden.
--
-- Fix: Ein SECURITY-DEFINER-RPC, das den SELECT und INSERT in einer
-- Transaktion ausführt und per pg_advisory_xact_lock() serialisiert.
-- Der Lock wird am Ende der Transaktion automatisch freigegeben.
-- ============================================================

CREATE OR REPLACE FUNCTION public.insert_categorization_rule(
  p_name text,
  p_rule_type text,
  p_condition jsonb,
  p_category_id uuid,
  p_is_active boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_next_sort_order int;
  v_id uuid;
BEGIN
  -- Zweite Verteidigungslinie: Auch wenn die API-Route bereits requireAdmin()
  -- aufruft, wird hier nochmals geprüft (Defense in Depth, SECURITY DEFINER).
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen Kategorisierungsregeln anlegen.'
      USING ERRCODE = '42501';
  END IF;

  -- Advisory-Lock serialisiert parallele Inserts auf diese Tabelle. Der
  -- Hash-Wert ist ein stabiler Schlüssel, damit nur sort_order-Inserts
  -- geblockt werden, nicht andere unabhängige Operationen.
  PERFORM pg_advisory_xact_lock(hashtext('categorization_rules_sort_order'));

  SELECT COALESCE(MAX(sort_order), -1) + 1
    INTO v_next_sort_order
    FROM public.categorization_rules;

  INSERT INTO public.categorization_rules (
    name,
    rule_type,
    condition,
    category_id,
    is_active,
    sort_order
  ) VALUES (
    p_name,
    p_rule_type,
    p_condition,
    p_category_id,
    COALESCE(p_is_active, true),
    v_next_sort_order
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.insert_categorization_rule(text, text, jsonb, uuid, boolean) IS
  'PROJ-13 BUG-007: Atomarer Insert einer Kategorisierungsregel mit automatisch vergebenem sort_order. Per Advisory-Lock gegen Race Conditions abgesichert.';

GRANT EXECUTE ON FUNCTION public.insert_categorization_rule(text, text, jsonb, uuid, boolean)
  TO authenticated;
