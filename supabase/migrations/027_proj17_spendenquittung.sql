-- ============================================================
-- PROJ-17: Spendenquittung (Zuwendungsbestätigung)
--
-- Neue Tabellen:
--   spender                – Wiederverwendbare Spenderadressen
--   spendenquittungen      – Ausgestellte Quittungen (unveränderliches Archiv)
--
-- Erweiterungen:
--   app_settings           – Neue Keys org_* für Vereinsdaten (kein Schema-Change)
--   pg_trgm                – Aktiviert für Spender-Fuzzy-Match
--
-- Storage-Bucket:
--   spendenquittungen      – Privat, Zugriff nur via signierte URLs (Admin)
-- ============================================================

-- 1. pg_trgm-Extension fuer Fuzzy-Match auf Spendername (similarity())
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


-- ============================================================
-- 2. Tabelle: spender
-- ============================================================
CREATE TABLE IF NOT EXISTS public.spender (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  strasse text CHECK (strasse IS NULL OR char_length(strasse) <= 200),
  plz text CHECK (plz IS NULL OR char_length(plz) <= 10),
  ort text CHECK (ort IS NULL OR char_length(ort) <= 100),
  email text CHECK (email IS NULL OR char_length(email) <= 200),
  iban text CHECK (iban IS NULL OR char_length(iban) <= 34),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spender ENABLE ROW LEVEL SECURITY;

-- Nur Admins duerfen Spender sehen/verwalten (DSGVO-sensible Daten)
CREATE POLICY "Admins koennen Spender lesen"
  ON public.spender FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins koennen Spender erstellen"
  ON public.spender FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins koennen Spender aktualisieren"
  ON public.spender FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins koennen Spender loeschen"
  ON public.spender FOR DELETE
  USING (public.is_admin());

-- Trigram-Index fuer Spender-Name-Fuzzy-Match (similarity())
CREATE INDEX IF NOT EXISTS idx_spender_name_trgm
  ON public.spender USING gin (name gin_trgm_ops);

-- Index fuer IBAN-Lookup (automatische Vorbefuellung bei wiederkehrenden Spendern)
CREATE INDEX IF NOT EXISTS idx_spender_iban
  ON public.spender(iban)
  WHERE iban IS NOT NULL;

-- Trigger: updated_at automatisch setzen
DROP TRIGGER IF EXISTS trg_spender_updated_at ON public.spender;
CREATE TRIGGER trg_spender_updated_at
  BEFORE UPDATE ON public.spender
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 3. Sequence fuer Quittungs-Nummer (race-condition-sicher)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.spendenquittung_nummer_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  CACHE 1;

-- RPC: Naechste Quittungsnummer im Format SQ-JJJJ-NNNN
-- Pro Jahr wird die laufende Nummer auf 1 zurueckgesetzt.
-- Die Sequence wird intern fortlaufend gefuehrt (Lecks erlaubt), die
-- Jahresnummer wird via Lookup auf vorhandene Quittungen ermittelt.
CREATE OR REPLACE FUNCTION public.next_spendenquittung_nummer()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_max_num integer;
  v_next_num integer;
BEGIN
  v_year := to_char(now(), 'YYYY');

  -- Hoechste laufende Nummer fuer das aktuelle Jahr ermitteln.
  -- Erwartetes Format: SQ-JJJJ-NNNN
  SELECT COALESCE(
    MAX(
      CAST(
        substring(quittung_nummer FROM 'SQ-' || v_year || '-(\d+)$')
        AS integer
      )
    ),
    0
  )
  INTO v_max_num
  FROM public.spendenquittungen
  WHERE quittung_nummer LIKE 'SQ-' || v_year || '-%';

  v_next_num := v_max_num + 1;

  RETURN 'SQ-' || v_year || '-' || lpad(v_next_num::text, 4, '0');
END;
$$;

-- Ausfuehrungsrechte: Nur authenticated (RLS in der API regelt Admin-Pflicht)
REVOKE ALL ON FUNCTION public.next_spendenquittung_nummer() FROM public;
GRANT EXECUTE ON FUNCTION public.next_spendenquittung_nummer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_spendenquittung_nummer() TO service_role;


-- ============================================================
-- 4. Tabelle: spendenquittungen
-- ============================================================
CREATE TABLE IF NOT EXISTS public.spendenquittungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quittung_nummer text NOT NULL UNIQUE
    CHECK (quittung_nummer ~ '^SQ-\d{4}-\d{4,}$'),
  -- Referenz zur urspruenglichen Buchung (nullable, damit Quittungen
  -- nicht verloren gehen, wenn die Buchung spaeter geloescht wird).
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  spender_id uuid NOT NULL REFERENCES public.spender(id) ON DELETE RESTRICT,
  betrag numeric(12,2) NOT NULL CHECK (betrag > 0),
  spende_datum date NOT NULL,
  quittung_datum date NOT NULL,
  zweck text NOT NULL CHECK (char_length(zweck) BETWEEN 1 AND 500),
  -- JSON-Abbild der Vereinsdaten zum Ausstellungszeitpunkt.
  -- Macht die Quittung resistent gegen spaetere Aenderungen an
  -- den Organisationseinstellungen.
  verein_snapshot jsonb NOT NULL,
  -- Pfad zum PDF in Supabase Storage (Bucket "spendenquittungen").
  pdf_path text NOT NULL,
  -- E-Mail-Versand
  email_versendet_am timestamptz,
  email_empfaenger text CHECK (email_empfaenger IS NULL OR char_length(email_empfaenger) <= 200),
  -- Audit
  erstellt_von uuid NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spendenquittungen ENABLE ROW LEVEL SECURITY;

-- Admins + Betrachter (viewer) duerfen Quittungen lesen.
-- Schreibrechte bleiben ausschliesslich beim Admin.
CREATE POLICY "Eingeloggte koennen Spendenquittungen lesen"
  ON public.spendenquittungen FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins koennen Spendenquittungen erstellen"
  ON public.spendenquittungen FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins koennen Spendenquittungen aktualisieren"
  ON public.spendenquittungen FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins koennen Spendenquittungen loeschen"
  ON public.spendenquittungen FOR DELETE
  USING (public.is_admin());

-- Indizes fuer haeufige Filter
CREATE INDEX IF NOT EXISTS idx_spendenquittungen_spende_datum
  ON public.spendenquittungen(spende_datum DESC);

CREATE INDEX IF NOT EXISTS idx_spendenquittungen_quittung_datum
  ON public.spendenquittungen(quittung_datum DESC);

CREATE INDEX IF NOT EXISTS idx_spendenquittungen_spender
  ON public.spendenquittungen(spender_id);

CREATE INDEX IF NOT EXISTS idx_spendenquittungen_transaction
  ON public.spendenquittungen(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- Index fuer Jahresfilter (extract aus spende_datum)
CREATE INDEX IF NOT EXISTS idx_spendenquittungen_jahr
  ON public.spendenquittungen((EXTRACT(YEAR FROM spende_datum)));

-- Index fuer Versandstatus-Filter
CREATE INDEX IF NOT EXISTS idx_spendenquittungen_email_status
  ON public.spendenquittungen((email_versendet_am IS NULL));


-- ============================================================
-- 5. Storage-Bucket: spendenquittungen (privat)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('spendenquittungen', 'spendenquittungen', false)
ON CONFLICT (id) DO NOTHING;

-- Storage-Policies: Nur Admins koennen lesen/schreiben/loeschen.
-- Hinweis: Mehrfaches Anlegen wuerde fehlschlagen, daher DROP IF EXISTS.
DROP POLICY IF EXISTS "Admins koennen Spendenquittungs-PDFs hochladen" ON storage.objects;
CREATE POLICY "Admins koennen Spendenquittungs-PDFs hochladen"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'spendenquittungen'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Admins koennen Spendenquittungs-PDFs lesen" ON storage.objects;
CREATE POLICY "Admins koennen Spendenquittungs-PDFs lesen"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'spendenquittungen'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Admins koennen Spendenquittungs-PDFs loeschen" ON storage.objects;
CREATE POLICY "Admins koennen Spendenquittungs-PDFs loeschen"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'spendenquittungen'
    AND public.is_admin()
  );


-- ============================================================
-- 6. Hinweise zu Organisationseinstellungen
-- ============================================================
-- Die Organisationseinstellungen werden in app_settings gespeichert.
-- Dafuer ist kein Schema-Change noetig. Verwendete Keys:
--
--   org_verein_name
--   org_adresse_zeile1
--   org_adresse_zeile2          (optional)
--   org_plz
--   org_ort
--   org_steuernummer
--   org_finanzamt
--   org_freistellungsbescheid_datum         (YYYY-MM-DD)
--   org_freistellungsbescheid_aktenzeichen
--   org_satzungszweck
--   org_unterzeichner_name
--   org_letzter_veranlagungszeitraum        (z. B. "2022 - 2024")
--
-- Die /api/admin/settings-Route wird so erweitert, dass sie diese
-- Keys lesen und schreiben kann (kein verschluesselter Inhalt).
