-- ============================================================
-- PROJ-15: Zusammengesetzte Kategorisierungsregeln
--
-- Eine Regel kann jetzt mehrere Kriterien enthalten, verknüpft
-- per UND oder ODER. Die feste `rule_type`-Spalte wird obsolet —
-- der Typ steckt jetzt pro Kriterium im JSONB.
--
-- Neue Struktur der `condition`-Spalte:
--   {
--     "combinator": "AND" | "OR",
--     "criteria": [
--       { "type": "text_contains",        "term": "..." },
--       { "type": "counterpart_contains", "term": "..." },
--       { "type": "amount_range",         "min": 0, "max": 0, "direction": "in" | "out" | "both" },
--       { "type": "month_quarter",        "months": [...] } | { "quarters": [...] }
--     ]
--   }
--
-- Migrationsweg: Der Benutzer hat aktuell eine Bestandsregel und
-- legt sie nach der Migration manuell neu an. Wir verwerfen daher
-- alle bestehenden Zeilen und wechseln hart auf das neue Schema.
-- ============================================================

-- 1. Bestandsdaten verwerfen (Benutzerbestätigung vorhanden).
TRUNCATE TABLE public.categorization_rules;

-- 2. Alte Typ-Spalte entfernen (inkl. CHECK-Constraint, der
--    automatisch mit der Spalte verschwindet).
ALTER TABLE public.categorization_rules
  DROP COLUMN rule_type;

-- 3. Kommentar an der condition-Spalte, damit die neue Struktur
--    im Schema sichtbar dokumentiert ist.
COMMENT ON COLUMN public.categorization_rules.condition IS
  'PROJ-15: Zusammengesetzte Bedingung im Format {combinator: "AND"|"OR", criteria: [...]}. Jedes Kriterium trägt seinen eigenen type (text_contains, counterpart_contains, amount_range, month_quarter) plus typ-spezifische Parameter.';
