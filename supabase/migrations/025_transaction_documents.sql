-- Mehrere Belege pro Buchung (max. 5 je Buchung, 10 MB pro Datei wird in der
-- API erzwungen). Ersetzt die bisherige Einzelreferenz `transactions.document_ref`.
-- Die Legacy-Spalte bleibt bis auf Weiteres bestehen, damit Altdaten ohne Daten-
-- verlust in die neue Tabelle überführt werden können und bereits ausgelieferte
-- Links (Excel-Export, Emails) weiterhin lesbar bleiben.

-- ============================================================
-- 1. Neue Tabelle transaction_documents
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transaction_documents (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id  uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  document_url    text NOT NULL,
  document_name   text NOT NULL,
  document_path   text,
  display_order   smallint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.transaction_documents ENABLE ROW LEVEL SECURITY;

-- Lesezugriff: Gleiche Logik wie für `transactions` – alle eingeloggten
-- Benutzer dürfen lesen. Die eigentliche Kategorie-Einschränkung (PROJ-14)
-- wird bei der Haupt-Buchungsabfrage via !inner-Join erzwungen; die
-- Dokumente werden stets als Embed der Transaktion mitgeliefert, sodass
-- ein eingeschränkter Betrachter ohnehin nur Dokumente zu sichtbaren
-- Buchungen zu sehen bekommt.
CREATE POLICY "Eingeloggte sehen Buchungs-Belege"
  ON public.transaction_documents
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert/Update/Delete läuft ausschließlich über den Service-Role-Client
-- in /api/transactions/[id]/documents (Permission-Check `edit_transactions`).

CREATE INDEX IF NOT EXISTS idx_transaction_documents_transaction
  ON public.transaction_documents(transaction_id);

-- ============================================================
-- 2. Altdaten aus transactions.document_ref übernehmen
-- ============================================================
-- Nur Einträge, die noch keinen Datensatz in transaction_documents haben
-- (idempotent). Der document_name wird aus dem Share-Link abgeleitet, was
-- für die Altdaten ausreichend ist (neue Uploads setzen den echten Namen).
INSERT INTO public.transaction_documents
  (transaction_id, document_url, document_name, document_path, display_order, created_at)
SELECT
  t.id,
  t.document_ref,
  COALESCE(
    NULLIF(regexp_replace(t.document_ref, '^.*/', ''), ''),
    'Beleg'
  ),
  NULL,
  0,
  COALESCE(t.updated_at, now())
FROM public.transactions t
WHERE t.document_ref IS NOT NULL
  AND t.document_ref <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.transaction_documents d
    WHERE d.transaction_id = t.id
  );
