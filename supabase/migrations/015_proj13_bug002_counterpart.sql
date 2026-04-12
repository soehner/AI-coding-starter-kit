-- ============================================================
-- PROJ-13 BUG-002: Separates Feld für Auftraggeber/Empfänger
--
-- Grund: Die Regeltypen `text_contains` und `counterpart_contains`
-- sollten laut Spezifikation unterschiedliche Felder durchsuchen.
-- Bisher gab es nur `description`, weshalb beide Regeltypen
-- faktisch identisch waren.
--
-- Diese Migration ergänzt eine optionale Spalte `counterpart` auf
-- `transactions`. Der KI-Parser füllt sie ab sofort, bestehende
-- Buchungen bleiben auf NULL (kein Backfill möglich, weil sich die
-- Namen aus dem freien Buchungstext nicht zuverlässig rekonstruieren
-- lassen). Regeln vom Typ `counterpart_contains` matchen strikt
-- gegen dieses Feld — bei NULL matcht die Regel nicht.
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN counterpart text;

COMMENT ON COLUMN public.transactions.counterpart IS
  'PROJ-13: Name des Auftraggebers/Empfängers, vom KI-Parser separat extrahiert. NULL für Altdaten vor dieser Migration.';

-- Kein Index: In der Praxis wird das Feld nur in der JS-seitigen
-- Regelprüfung (`String.includes`) genutzt, nicht in SQL-WHERE.
