-- ============================================================
-- PROJ-3: PDF-Kontoauszug-Upload & Parsing
-- Tabellen: app_settings, bank_statements, transactions
-- ============================================================

-- 1. App-Einstellungen (KI-Provider + verschluesselter Token)
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Nur Admins duerfen Einstellungen lesen
CREATE POLICY "Admins koennen Einstellungen lesen"
  ON public.app_settings FOR SELECT
  USING (public.is_admin());

-- Nur Admins duerfen Einstellungen erstellen
CREATE POLICY "Admins koennen Einstellungen erstellen"
  ON public.app_settings FOR INSERT
  WITH CHECK (public.is_admin());

-- Nur Admins duerfen Einstellungen aktualisieren
CREATE POLICY "Admins koennen Einstellungen aktualisieren"
  ON public.app_settings FOR UPDATE
  USING (public.is_admin());

-- Nur Admins duerfen Einstellungen loeschen
CREATE POLICY "Admins koennen Einstellungen loeschen"
  ON public.app_settings FOR DELETE
  USING (public.is_admin());

CREATE INDEX idx_app_settings_key ON public.app_settings(key);


-- 2. Kontoauszuege (Metadaten importierter PDFs)
CREATE TABLE public.bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  statement_date date NOT NULL,
  statement_number text NOT NULL,
  transaction_count integer NOT NULL DEFAULT 0,
  start_balance numeric NOT NULL DEFAULT 0,
  end_balance numeric NOT NULL DEFAULT 0,
  file_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

-- Admins duerfen alles, Viewer duerfen lesen
CREATE POLICY "Admins koennen Kontoauszuege lesen"
  ON public.bank_statements FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Viewer koennen Kontoauszuege lesen"
  ON public.bank_statements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'viewer'
    )
  );

CREATE POLICY "Admins koennen Kontoauszuege erstellen"
  ON public.bank_statements FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins koennen Kontoauszuege aktualisieren"
  ON public.bank_statements FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins koennen Kontoauszuege loeschen"
  ON public.bank_statements FOR DELETE
  USING (public.is_admin());

CREATE INDEX idx_bank_statements_date ON public.bank_statements(statement_date DESC);
CREATE INDEX idx_bank_statements_number ON public.bank_statements(statement_number);
CREATE INDEX idx_bank_statements_uploaded_by ON public.bank_statements(uploaded_by);


-- 3. Buchungen (einzelne Transaktionen)
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  value_date date NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  category text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Admins duerfen alles, Viewer duerfen lesen
CREATE POLICY "Admins koennen Buchungen lesen"
  ON public.transactions FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Viewer koennen Buchungen lesen"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'viewer'
    )
  );

CREATE POLICY "Admins koennen Buchungen erstellen"
  ON public.transactions FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins koennen Buchungen aktualisieren"
  ON public.transactions FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins koennen Buchungen loeschen"
  ON public.transactions FOR DELETE
  USING (public.is_admin());

CREATE INDEX idx_transactions_statement_id ON public.transactions(statement_id);
CREATE INDEX idx_transactions_booking_date ON public.transactions(booking_date DESC);
CREATE INDEX idx_transactions_amount ON public.transactions(amount);

-- Zusammengesetzter Index fuer Duplikat-Erkennung
CREATE INDEX idx_transactions_duplicate_check
  ON public.transactions(booking_date, amount, description);


-- 4. Trigger: updated_at automatisch setzen
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- 5. Supabase Storage Bucket fuer Kontoauszuege
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-statements', 'bank-statements', false)
ON CONFLICT (id) DO NOTHING;

-- Storage-Policies: Nur authentifizierte Admins
CREATE POLICY "Admins koennen Dateien hochladen"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'bank-statements'
    AND public.is_admin()
  );

CREATE POLICY "Admins koennen Dateien lesen"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bank-statements'
    AND public.is_admin()
  );

CREATE POLICY "Admins koennen Dateien loeschen"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'bank-statements'
    AND public.is_admin()
  );
