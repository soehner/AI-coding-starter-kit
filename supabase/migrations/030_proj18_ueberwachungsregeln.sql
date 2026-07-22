-- ============================================================
-- PROJ-18: Überwachungsregeln & E-Mail-Benachrichtigung bei
--          verdächtigen Kontobewegungen
--
-- Neue Tabellen:
--   ueberwachungsregeln              – Konfigurierbare Regeln (Admin-only)
--   ueberwachungs_benachrichtigungen – Log/Dedup ausgelöster Benachrichtigungen
--
-- Die Prüfung läuft im PSD2-Cron über den Service-Role-Client (umgeht RLS).
-- Alle CRUD-Zugriffe aus der App laufen über Admin-Sessions → RLS is_admin().
-- ============================================================

-- ============================================================
-- 1. Tabelle: ueberwachungsregeln
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ueberwachungsregeln (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  freitext_original text CHECK (
    freitext_original IS NULL OR char_length(freitext_original) <= 2000
  ),
  regel_typ text NOT NULL CHECK (regel_typ IN ('einzelbuchung', 'muster')),
  -- Strukturierte, von der KI übersetzte Bedingung:
  --   einzelbuchung: { combinator, criteria[] }
  --   muster:        { combinator, criteria[], muster: {art, schwelle, zeitfenster_tage} }
  bedingung jsonb NOT NULL,
  -- Freie E-Mail-Adressen der Benachrichtigungs-Empfänger (server-seitig per Zod validiert)
  empfaenger text[] NOT NULL DEFAULT '{}',
  ist_aktiv boolean NOT NULL DEFAULT true,
  sortierung integer NOT NULL DEFAULT 0,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  erstellt_von uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- coalesce, weil array_length('{}',1) NULL liefert und CHECK NULL als
  -- „bestanden" wertet — ohne coalesce würde ein leeres Array durchrutschen.
  CONSTRAINT ueberwachungsregeln_empfaenger_nonempty
    CHECK (coalesce(array_length(empfaenger, 1), 0) >= 1)
);

-- Indizes für typische Abfragen (Reihenfolge + Filter nach aktiv)
CREATE INDEX IF NOT EXISTS idx_ueberwachungsregeln_sortierung
  ON public.ueberwachungsregeln (sortierung);

CREATE INDEX IF NOT EXISTS idx_ueberwachungsregeln_aktiv
  ON public.ueberwachungsregeln (ist_aktiv)
  WHERE ist_aktiv = true;

ALTER TABLE public.ueberwachungsregeln ENABLE ROW LEVEL SECURITY;

-- RLS: Nur Admins dürfen Regeln lesen und schreiben
CREATE POLICY "Admins lesen Ueberwachungsregeln"
  ON public.ueberwachungsregeln FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins legen Ueberwachungsregeln an"
  ON public.ueberwachungsregeln FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins aktualisieren Ueberwachungsregeln"
  ON public.ueberwachungsregeln FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins loeschen Ueberwachungsregeln"
  ON public.ueberwachungsregeln FOR DELETE
  USING (public.is_admin());


-- ============================================================
-- 2. Tabelle: ueberwachungs_benachrichtigungen (Log + Dedup)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ueberwachungs_benachrichtigungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Regel bleibt bei Löschung als Historie erhalten (Verweis → NULL statt CASCADE)
  regel_id uuid REFERENCES public.ueberwachungsregeln(id) ON DELETE SET NULL,
  -- Snapshot des Regelnamens zum Auslösezeitpunkt (bleibt lesbar nach Umbenennung/Löschung)
  regel_name_stand text NOT NULL,
  -- Betroffene Buchungen: eine (einzelbuchung) bzw. mehrere (muster).
  -- Kein FK-Array möglich; Buchungslöschung lässt die IDs als Historie stehen.
  betroffene_buchungen uuid[] NOT NULL DEFAULT '{}',
  -- Eindeutiger Fingerabdruck (Regel + Buchung bzw. Regel + Muster-Fenster).
  -- Verhindert doppelte Benachrichtigung für denselben Fall.
  dedup_schluessel text NOT NULL,
  ausgeloest_am timestamptz NOT NULL DEFAULT now(),
  -- Tatsächlich benachrichtigte Empfänger (Snapshot)
  versendet_an text[] NOT NULL DEFAULT '{}'
);

-- Dedup: derselbe Fall darf nur einmal protokolliert werden.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_ueberwachungs_benachr_dedup
  ON public.ueberwachungs_benachrichtigungen (dedup_schluessel);

CREATE INDEX IF NOT EXISTS idx_ueberwachungs_benachr_regel
  ON public.ueberwachungs_benachrichtigungen (regel_id);

CREATE INDEX IF NOT EXISTS idx_ueberwachungs_benachr_ausgeloest
  ON public.ueberwachungs_benachrichtigungen (ausgeloest_am DESC);

ALTER TABLE public.ueberwachungs_benachrichtigungen ENABLE ROW LEVEL SECURITY;

-- RLS: Nur Admins dürfen das Protokoll lesen. Schreibzugriff erfolgt
-- ausschließlich über den Service-Role-Client im Cron (umgeht RLS),
-- daher gibt es bewusst KEINE INSERT/UPDATE/DELETE-Policy für Sessions.
CREATE POLICY "Admins lesen Ueberwachungs-Benachrichtigungen"
  ON public.ueberwachungs_benachrichtigungen FOR SELECT
  USING (public.is_admin());


-- ============================================================
-- 3. Zusätzliche Indizes auf transactions für Muster-/Aggregatabfragen
--    (Zeitfenster-Auswertung über iban_gegenseite bzw. Betrag)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transactions_iban_gegenseite_booking
  ON public.transactions (iban_gegenseite, booking_date);
