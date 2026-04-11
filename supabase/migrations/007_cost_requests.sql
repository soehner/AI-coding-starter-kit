-- PROJ-11: Kostenübernahme-Antrag
-- Tabellen für Anträge, Abstimmungen, Tokens und Genehmiger-Konfiguration

-- ============================================================
-- 1. Genehmiger-Konfiguration (3 feste Rollen)
-- ============================================================
CREATE TABLE cost_request_approvers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  approval_role text NOT NULL UNIQUE CHECK (approval_role IN ('vorsitzender_1', 'vorsitzender_2', 'kassier')),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  label text NOT NULL,  -- z.B. "1. Vorsitzender", "2. Vorsitzender", "Kassier"
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Standardwerte einfügen (werden später per Admin-UI zugewiesen)
-- Vorerst ohne user_id - die werden beim Setup gesetzt

ALTER TABLE cost_request_approvers ENABLE ROW LEVEL SECURITY;

-- Admins können alles lesen und schreiben
CREATE POLICY "Admins können Genehmiger verwalten"
  ON cost_request_approvers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Alle eingeloggten Benutzer können Genehmiger lesen (für Anzeige)
CREATE POLICY "Eingeloggte Benutzer können Genehmiger lesen"
  ON cost_request_approvers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 2. Kostenübernahme-Anträge
-- ============================================================
CREATE TABLE cost_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_first_name text NOT NULL,
  applicant_last_name text NOT NULL,
  applicant_email text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'genehmigt', 'abgelehnt')),
  email_status text NOT NULL DEFAULT 'ausstehend' CHECK (email_status IN ('ausstehend', 'gesendet', 'fehlgeschlagen')),
  decided_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE cost_requests ENABLE ROW LEVEL SECURITY;

-- Öffentlich: Jeder kann einen Antrag erstellen (via Service-Role-Key in API)
-- Kein direkter RLS-Zugriff für anonyme Benutzer - API nutzt Admin-Client

-- Admins können alle Anträge lesen
CREATE POLICY "Admins können Anträge lesen"
  ON cost_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Admins können Anträge aktualisieren (z.B. Status)
CREATE POLICY "Admins können Anträge aktualisieren"
  ON cost_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE INDEX idx_cost_requests_status ON cost_requests(status);
CREATE INDEX idx_cost_requests_created_at ON cost_requests(created_at DESC);

-- ============================================================
-- 3. Abstimmungs-Tokens
-- ============================================================
CREATE TABLE cost_request_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cost_request_id uuid NOT NULL REFERENCES cost_requests(id) ON DELETE CASCADE,
  approval_role text NOT NULL CHECK (approval_role IN ('vorsitzender_1', 'vorsitzender_2', 'kassier')),
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'verbraucht', 'abgelaufen')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE(cost_request_id, approval_role)
);

ALTER TABLE cost_request_tokens ENABLE ROW LEVEL SECURITY;

-- Keine RLS-Policies für direkte Benutzer - Token-Zugriff erfolgt über Service-Role-Key

-- Admins können Tokens lesen (für Debugging/Übersicht)
CREATE POLICY "Admins können Tokens lesen"
  ON cost_request_tokens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE INDEX idx_cost_request_tokens_hash ON cost_request_tokens(token_hash);
CREATE INDEX idx_cost_request_tokens_request ON cost_request_tokens(cost_request_id);

-- ============================================================
-- 4. Einzelstimmen
-- ============================================================
CREATE TABLE cost_request_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cost_request_id uuid NOT NULL REFERENCES cost_requests(id) ON DELETE CASCADE,
  approval_role text NOT NULL CHECK (approval_role IN ('vorsitzender_1', 'vorsitzender_2', 'kassier')),
  decision text NOT NULL CHECK (decision IN ('genehmigt', 'abgelehnt')),
  voted_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE(cost_request_id, approval_role)
);

ALTER TABLE cost_request_votes ENABLE ROW LEVEL SECURITY;

-- Admins können Stimmen lesen
CREATE POLICY "Admins können Stimmen lesen"
  ON cost_request_votes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE INDEX idx_cost_request_votes_request ON cost_request_votes(cost_request_id);
