-- PROJ-8: Zwei-Faktor-Authentifizierung – Backup-Codes und Rate-Limiting
-- Migration 008

-- ============================================================
-- Tabelle: mfa_backup_codes
-- Speichert gehashte Einmal-Backup-Codes für 2FA-Recovery
-- ============================================================
CREATE TABLE mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS aktivieren
ALTER TABLE mfa_backup_codes ENABLE ROW LEVEL SECURITY;

-- Benutzer dürfen nur ihre eigenen Backup-Codes lesen (um Anzahl verbleibender Codes zu sehen)
CREATE POLICY "Benutzer sehen eigene Backup-Codes"
  ON mfa_backup_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Nur der Server (service_role) darf Backup-Codes erstellen
-- Kein INSERT-Policy für normale Benutzer – wird über Admin-Client gemacht

-- Nur der Server (service_role) darf Backup-Codes als verwendet markieren
-- Kein UPDATE-Policy für normale Benutzer – wird über Admin-Client gemacht

-- Benutzer dürfen ihre eigenen Backup-Codes löschen (beim Regenerieren)
CREATE POLICY "Benutzer löschen eigene Backup-Codes"
  ON mfa_backup_codes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indizes für performante Abfragen
CREATE INDEX idx_mfa_backup_codes_user_id ON mfa_backup_codes(user_id);
CREATE INDEX idx_mfa_backup_codes_user_unused ON mfa_backup_codes(user_id) WHERE used_at IS NULL;

-- ============================================================
-- Tabelle: mfa_rate_limits
-- Schützt gegen Brute-Force-Angriffe auf 2FA-Codes
-- ============================================================
CREATE TABLE mfa_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  fehlversuche INTEGER NOT NULL DEFAULT 0,
  gesperrt_bis TIMESTAMPTZ DEFAULT NULL,
  zuletzt_versucht_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS aktivieren
ALTER TABLE mfa_rate_limits ENABLE ROW LEVEL SECURITY;

-- Keine direkte Benutzer-Zugriffs-Policy – Rate-Limiting wird ausschließlich
-- über den Server (service_role / Admin-Client) verwaltet

-- Index für schnelle Lookups nach User-ID und IP
CREATE INDEX idx_mfa_rate_limits_user_id ON mfa_rate_limits(user_id);
CREATE INDEX idx_mfa_rate_limits_ip ON mfa_rate_limits(ip_address);
CREATE INDEX idx_mfa_rate_limits_user_ip ON mfa_rate_limits(user_id, ip_address);
