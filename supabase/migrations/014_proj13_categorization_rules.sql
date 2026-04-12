-- PROJ-13: Automatische Kategorisierungsregeln
-- Tabelle `categorization_rules` inkl. RLS, Indizes und Trigger zur
-- Deaktivierung bei Kategorie-Löschung.

-- =========================================================================
-- 1. Tabelle categorization_rules
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.categorization_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  rule_type text NOT NULL CHECK (
    rule_type IN (
      'text_contains',
      'counterpart_contains',
      'amount_range',
      'month_quarter'
    )
  ),
  condition jsonb NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_invalid boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indizes für typische Abfragen (Reihenfolge + Filter nach Kategorie)
CREATE INDEX IF NOT EXISTS idx_categorization_rules_sort_order
  ON public.categorization_rules (sort_order);

CREATE INDEX IF NOT EXISTS idx_categorization_rules_category_id
  ON public.categorization_rules (category_id);

CREATE INDEX IF NOT EXISTS idx_categorization_rules_active
  ON public.categorization_rules (is_active)
  WHERE is_active = true;

ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;

-- RLS: Nur Admins dürfen Regeln lesen und schreiben
CREATE POLICY "Admins lesen Regeln"
  ON public.categorization_rules FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins legen Regeln an"
  ON public.categorization_rules FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins aktualisieren Regeln"
  ON public.categorization_rules FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins löschen Regeln"
  ON public.categorization_rules FOR DELETE
  USING (public.is_admin());

-- =========================================================================
-- 2. Trigger: Wenn eine Kategorie gelöscht wird, wird die Regel deaktiviert
--    und als ungültig markiert (statt vollständig zu löschen).
--    Die FK-Spalte wird dank ON DELETE SET NULL automatisch auf NULL gesetzt.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.mark_rule_invalid_on_category_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Wenn die Zielkategorie auf NULL gesetzt wurde, Regel deaktivieren.
  IF NEW.category_id IS NULL AND OLD.category_id IS NOT NULL THEN
    NEW.is_active := false;
    NEW.is_invalid := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS categorization_rules_invalidate
  ON public.categorization_rules;

CREATE TRIGGER categorization_rules_invalidate
  BEFORE UPDATE OF category_id ON public.categorization_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_rule_invalid_on_category_delete();
