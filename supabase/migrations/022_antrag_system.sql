-- PROJ-11 Neubau: Öffentliche Kostenübernahme-Anträge mit eigenem
-- Genehmiger-Pool (unabhängig von PROJ-10 Vorstandsrollen).
-- Ersetzt das alte cost_requests-System.

-- ============================================================
-- 1. Antrags-Tabelle
-- ============================================================
CREATE TABLE IF NOT EXISTS public.antraege (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_first_name text NOT NULL CHECK (char_length(applicant_first_name) BETWEEN 1 AND 100),
  applicant_last_name  text NOT NULL CHECK (char_length(applicant_last_name) BETWEEN 1 AND 100),
  applicant_email      text NOT NULL CHECK (char_length(applicant_email) BETWEEN 3 AND 320),
  amount_cents         bigint NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 9999999999),
  purpose              text NOT NULL CHECK (char_length(purpose) BETWEEN 1 AND 2000),
  status               text NOT NULL DEFAULT 'offen'
                       CHECK (status IN ('offen', 'genehmigt', 'abgelehnt')),
  email_status         text NOT NULL DEFAULT 'ausstehend'
                       CHECK (email_status IN ('ausstehend', 'gesendet', 'fehlgeschlagen')),
  decided_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.antraege ENABLE ROW LEVEL SECURITY;

-- Alle eingeloggten Benutzer dürfen Anträge lesen (Admin-Übersicht)
CREATE POLICY "Eingeloggte sehen Anträge"
  ON public.antraege
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert/Update/Delete ausschließlich über Service-Role-Client
-- (öffentlicher POST-Endpoint + admin-Endpoints benutzen Admin-Client)

CREATE INDEX IF NOT EXISTS idx_antraege_status     ON public.antraege(status);
CREATE INDEX IF NOT EXISTS idx_antraege_created_at ON public.antraege(created_at DESC);

CREATE OR REPLACE FUNCTION public.antraege_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_antraege_updated_at ON public.antraege;
CREATE TRIGGER trg_antraege_updated_at
  BEFORE UPDATE ON public.antraege
  FOR EACH ROW
  EXECUTE FUNCTION public.antraege_set_updated_at();

-- ============================================================
-- 2. Antrag-Dokumente (Anhänge vom Antragsteller)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.antrag_dokumente (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  antrag_id      uuid NOT NULL REFERENCES public.antraege(id) ON DELETE CASCADE,
  document_url   text NOT NULL,
  document_name  text NOT NULL,
  document_path  text,
  display_order  smallint NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.antrag_dokumente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eingeloggte sehen Antragsdokumente"
  ON public.antrag_dokumente
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_antrag_dokumente_antrag
  ON public.antrag_dokumente(antrag_id);

-- ============================================================
-- 3. Genehmiger-Pool (wird in Einstellungen gepflegt)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.antrag_genehmiger (
  user_id    uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  added_by   uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.antrag_genehmiger ENABLE ROW LEVEL SECURITY;

-- Alle eingeloggten Benutzer dürfen lesen (UI-Info)
CREATE POLICY "Eingeloggte sehen Genehmiger-Pool"
  ON public.antrag_genehmiger
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert/Update/Delete läuft ausschließlich über den Service-Role-Client
-- (Admin-API prüft is_admin() vorher im Code).

-- ============================================================
-- 4. Entscheidungen (ein Datensatz pro Genehmiger pro Antrag)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.antrag_entscheidungen (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  antrag_id         uuid NOT NULL REFERENCES public.antraege(id) ON DELETE CASCADE,
  approver_user_id  uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  decision          text NOT NULL CHECK (decision IN ('genehmigt', 'abgelehnt')),
  comment           text CHECK (comment IS NULL OR char_length(comment) <= 1000),
  decided_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(antrag_id, approver_user_id)
);

ALTER TABLE public.antrag_entscheidungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eingeloggte sehen Antrag-Entscheidungen"
  ON public.antrag_entscheidungen
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_antrag_entscheidungen_antrag
  ON public.antrag_entscheidungen(antrag_id);
CREATE INDEX IF NOT EXISTS idx_antrag_entscheidungen_approver
  ON public.antrag_entscheidungen(approver_user_id);

-- ============================================================
-- 5. Tokens für Einmal-Links (ein Token pro Genehmiger pro Antrag)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.antrag_tokens (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  antrag_id         uuid NOT NULL REFERENCES public.antraege(id) ON DELETE CASCADE,
  approver_user_id  uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  token_hash        text NOT NULL UNIQUE,
  status            text NOT NULL DEFAULT 'aktiv'
                    CHECK (status IN ('aktiv', 'verbraucht', 'abgelaufen')),
  expires_at        timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(antrag_id, approver_user_id)
);

ALTER TABLE public.antrag_tokens ENABLE ROW LEVEL SECURITY;

-- Admins dürfen Tokens lesen (Debugging)
CREATE POLICY "Admins lesen Antrag-Tokens"
  ON public.antrag_tokens
  FOR SELECT
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_antrag_tokens_hash
  ON public.antrag_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_antrag_tokens_antrag
  ON public.antrag_tokens(antrag_id);
CREATE INDEX IF NOT EXISTS idx_antrag_tokens_status
  ON public.antrag_tokens(status);

-- ============================================================
-- 6. Alte cost_requests-Tabellen endgültig entfernen (falls noch da)
-- ============================================================
DROP TABLE IF EXISTS public.cost_request_votes     CASCADE;
DROP TABLE IF EXISTS public.cost_request_tokens    CASCADE;
DROP TABLE IF EXISTS public.cost_request_approvers CASCADE;
DROP TABLE IF EXISTS public.cost_requests          CASCADE;
