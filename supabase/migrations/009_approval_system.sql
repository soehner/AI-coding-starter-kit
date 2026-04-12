-- PROJ-10: Genehmigungssystem für Vereinsanträge
-- Tabellen für Anträge, Entscheidungen, Tokens + Profil-Erweiterung um Zusatzrollen

-- ============================================================
-- 1. Profil-Erweiterung: Zusatzrollen Vorstand / 2. Vorstand
-- ============================================================
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS ist_vorstand boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ist_zweiter_vorstand boolean NOT NULL DEFAULT false;

-- Indizes für schnelles Finden aller Genehmiger einer Rolle
CREATE INDEX IF NOT EXISTS idx_user_profiles_ist_vorstand
  ON public.user_profiles(ist_vorstand)
  WHERE ist_vorstand = true;

CREATE INDEX IF NOT EXISTS idx_user_profiles_ist_zweiter_vorstand
  ON public.user_profiles(ist_zweiter_vorstand)
  WHERE ist_zweiter_vorstand = true;

-- ============================================================
-- 2. Genehmigungsanträge
-- ============================================================
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 2000),
  document_url text NOT NULL,
  document_name text NOT NULL,
  document_path text,
  required_roles text[] NOT NULL CHECK (
    array_length(required_roles, 1) BETWEEN 1 AND 2
    AND required_roles <@ ARRAY['vorstand', 'zweiter_vorstand']::text[]
  ),
  link_type text NOT NULL DEFAULT 'und' CHECK (link_type IN ('und', 'oder')),
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'genehmigt', 'abgelehnt', 'entwurf')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- Alle eingeloggten Benutzer dürfen Anträge lesen (Übersichtsseite)
CREATE POLICY "Eingeloggte sehen alle Anträge"
  ON public.approval_requests
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Nur Admins dürfen Anträge einfügen
CREATE POLICY "Admins erstellen Anträge"
  ON public.approval_requests
  FOR INSERT
  WITH CHECK (public.is_admin());

-- Nur Admins dürfen Anträge aktualisieren (z.B. Status, Resubmit)
CREATE POLICY "Admins aktualisieren Anträge"
  ON public.approval_requests
  FOR UPDATE
  USING (public.is_admin());

-- Nur Admins dürfen Anträge löschen
CREATE POLICY "Admins löschen Anträge"
  ON public.approval_requests
  FOR DELETE
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_approval_requests_status
  ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created_at
  ON public.approval_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created_by
  ON public.approval_requests(created_by);

-- ============================================================
-- 3. Einzelentscheidungen der Genehmiger
-- ============================================================
CREATE TABLE IF NOT EXISTS public.approval_decisions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  approver_role text NOT NULL CHECK (approver_role IN ('vorstand', 'zweiter_vorstand')),
  decision text NOT NULL CHECK (decision IN ('genehmigt', 'abgelehnt')),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 1000),
  decided_at timestamptz NOT NULL DEFAULT now(),

  -- Pro Antrag + Rolle darf nur eine Entscheidung existieren
  UNIQUE(request_id, approver_role)
);

ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;

-- Alle eingeloggten Benutzer dürfen Entscheidungen lesen (Transparenz)
CREATE POLICY "Eingeloggte sehen Entscheidungen"
  ON public.approval_decisions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Einfügen/Aktualisieren erfolgt ausschließlich über den Service-Role-Client
-- (Token-basierter öffentlicher Endpunkt) — keine Policies für anon/authenticated.

CREATE INDEX IF NOT EXISTS idx_approval_decisions_request
  ON public.approval_decisions(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_decisions_approver
  ON public.approval_decisions(approver_id);

-- ============================================================
-- 4. Token-Tabelle für Einmallinks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.approval_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  approver_role text NOT NULL CHECK (approver_role IN ('vorstand', 'zweiter_vorstand')),
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'verbraucht', 'abgelaufen')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Pro Antrag + Genehmiger nur ein aktives Token
  UNIQUE(request_id, approver_id)
);

ALTER TABLE public.approval_tokens ENABLE ROW LEVEL SECURITY;

-- Admins dürfen Tokens lesen (Debugging/Übersicht)
CREATE POLICY "Admins lesen Tokens"
  ON public.approval_tokens
  FOR SELECT
  USING (public.is_admin());

-- Keine weiteren Policies — Zugriff nur über Service-Role-Client

CREATE INDEX IF NOT EXISTS idx_approval_tokens_hash
  ON public.approval_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_request
  ON public.approval_tokens(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_status
  ON public.approval_tokens(status);

-- ============================================================
-- 5. Auto-Update updated_at bei Änderungen an approval_requests
-- ============================================================
CREATE OR REPLACE FUNCTION public.approval_requests_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approval_requests_updated_at ON public.approval_requests;
CREATE TRIGGER trg_approval_requests_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.approval_requests_set_updated_at();
