-- ============================================================
-- PROJ-5: Eintragsbearbeitung & Bemerkungen
-- Erweitert transactions um Beleg-/Auszugsreferenz und Audit-Feld
-- ============================================================

-- 1. Neue Spalten hinzufügen
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS document_ref text,
  ADD COLUMN IF NOT EXISTS statement_ref text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- 2. Index auf updated_at für spätere Änderungshistorie
CREATE INDEX IF NOT EXISTS idx_transactions_updated_at
  ON public.transactions(updated_at DESC);

-- 3. Kommentare zur Dokumentation
COMMENT ON COLUMN public.transactions.document_ref IS 'Beleg-Referenz (z. B. Seafile-Link oder Dateiname)';
COMMENT ON COLUMN public.transactions.statement_ref IS 'Kontoauszug-Referenz (manuelle Zuordnung)';
COMMENT ON COLUMN public.transactions.updated_by IS 'Benutzer-ID der letzten Änderung';
