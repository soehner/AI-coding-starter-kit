-- ============================================================
-- PROJ-16: Direkter Bankabruf (PSD2) mit PDF-Abgleich
-- Erweitert die bestehende transactions-Tabelle (aus PROJ-3)
-- um Matching-/Herkunftsfelder und legt psd2_verbindungen an.
-- ============================================================

-- 1. Erweiterung der transactions-Tabelle
-- Hinweis: In der Feature-Spec ist die Rede von "bank_umsaetze"; in der
-- tatsaechlichen Datenbank heisst die Tabelle "transactions" (PROJ-3).
-- Die neuen Felder werden hier hinzugefuegt.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS matching_hash text,
  ADD COLUMN IF NOT EXISTS quelle text
    CHECK (quelle IN ('psd2','pdf','beide'))
    NOT NULL DEFAULT 'pdf',
  ADD COLUMN IF NOT EXISTS status text
    CHECK (status IN ('nur_psd2','nur_pdf','bestaetigt','vorschlag','konflikt'))
    NOT NULL DEFAULT 'nur_pdf',
  ADD COLUMN IF NOT EXISTS psd2_abgerufen_am timestamptz,
  ADD COLUMN IF NOT EXISTS psd2_original_data jsonb,
  ADD COLUMN IF NOT EXISTS iban_gegenseite text,
  -- Paare, die der Kassenwart explizit als "nicht identisch" markiert hat.
  -- Bei einem neuen Fuzzy-Match werden diese IDs uebersprungen.
  ADD COLUMN IF NOT EXISTS nicht_matchen_mit uuid[] NOT NULL DEFAULT '{}';

-- Bestehende Zeilen (aus PROJ-3) sind reine PDF-Importe.
-- Die Default-Werte 'pdf' / 'nur_pdf' werden durch den DEFAULT-Clause
-- automatisch gesetzt. matching_hash bleibt NULL und wird nachtraeglich
-- vom Backfill-Endpoint /api/admin/psd2/backfill-hashes befuellt.

-- Unique-Index auf matching_hash, aber nur wo er gesetzt ist.
-- So koennen bestehende Zeilen ohne Hash koexistieren, und neue Zeilen
-- sind auf DB-Ebene gegen Duplikate geschuetzt.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_matching_hash
  ON public.transactions(matching_hash)
  WHERE matching_hash IS NOT NULL;

-- Index fuer Fuzzy-Match (Datum +/- 1 Tag, Betrag, IBAN).
CREATE INDEX IF NOT EXISTS idx_transactions_fuzzy_match
  ON public.transactions(booking_date, amount, iban_gegenseite);

-- Index fuer Status-Filter im Dashboard ("nur unbestaetigte anzeigen").
CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON public.transactions(status);

-- Index fuer Herkunfts-Filter.
CREATE INDEX IF NOT EXISTS idx_transactions_quelle
  ON public.transactions(quelle);


-- 2. Neue Tabelle psd2_verbindungen
CREATE TABLE IF NOT EXISTS public.psd2_verbindungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gocardless_requisition_id text NOT NULL,
  gocardless_account_id text,
  -- GoCardless liefert beim Callback einen Agreement-Status;
  -- account_id wird erst nach erfolgreichem Consent gesetzt.
  institution_id text NOT NULL,
  consent_gueltig_bis date,
  letzter_abruf_am timestamptz,
  letzter_abruf_status text CHECK (letzter_abruf_status IN ('erfolg','fehler')),
  letzter_abruf_fehler text,
  -- Anzahl aufeinanderfolgender Fehlschlaege (fuer "drittes Mal"-Regel).
  aufeinanderfolgende_fehler integer NOT NULL DEFAULT 0,
  -- Zeitstempel der letzten Consent-Renewal-Erinnerungs-Mail (Dedup).
  letzte_renewal_mail_am timestamptz,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  erstellt_von uuid NOT NULL REFERENCES auth.users(id)
);

ALTER TABLE public.psd2_verbindungen ENABLE ROW LEVEL SECURITY;

-- Nur Admins duerfen PSD2-Verbindungen sehen/verwalten.
CREATE POLICY "Admins koennen PSD2-Verbindungen lesen"
  ON public.psd2_verbindungen FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins koennen PSD2-Verbindungen erstellen"
  ON public.psd2_verbindungen FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins koennen PSD2-Verbindungen aktualisieren"
  ON public.psd2_verbindungen FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins koennen PSD2-Verbindungen loeschen"
  ON public.psd2_verbindungen FOR DELETE
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_psd2_verbindungen_gueltig
  ON public.psd2_verbindungen(consent_gueltig_bis);


-- 3. Schema-Cache neu laden (wird vom Aufrufer via NOTIFY nachgezogen).
