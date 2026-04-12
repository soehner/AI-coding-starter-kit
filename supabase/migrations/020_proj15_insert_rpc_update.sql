-- ============================================================
-- PROJ-15: RPC `insert_categorization_rule` an das neue Schema
-- anpassen. Der Parameter `p_rule_type` entfällt, weil der Typ
-- jetzt pro Kriterium im `condition`-JSONB steckt.
--
-- Advisory-Lock und SECURITY DEFINER bleiben wie in PROJ-13 /
-- Migration 016 — dies ist nur ein Signatur-Update, keine
-- funktionale Änderung der Sperr-Semantik.
-- ============================================================

-- Alte Signatur entfernen
DROP FUNCTION IF EXISTS public.insert_categorization_rule(
  text, text, jsonb, uuid, boolean
);

-- Neue Signatur: ohne rule_type
CREATE OR REPLACE FUNCTION public.insert_categorization_rule(
  p_name text,
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
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen Kategorisierungsregeln anlegen.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('categorization_rules_sort_order'));

  SELECT COALESCE(MAX(sort_order), -1) + 1
    INTO v_next_sort_order
    FROM public.categorization_rules;

  INSERT INTO public.categorization_rules (
    name,
    condition,
    category_id,
    is_active,
    sort_order
  ) VALUES (
    p_name,
    p_condition,
    p_category_id,
    COALESCE(p_is_active, true),
    v_next_sort_order
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.insert_categorization_rule(text, jsonb, uuid, boolean) IS
  'PROJ-15: Atomarer Insert einer Kategorisierungsregel mit zusammengesetzter condition {combinator, criteria}. Advisory-Lock gegen Race Conditions auf sort_order.';

GRANT EXECUTE ON FUNCTION public.insert_categorization_rule(text, jsonb, uuid, boolean)
  TO authenticated;
