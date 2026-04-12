-- PROJ-12: Buchungskategorisierung
-- Tabellen `categories` und `transaction_categories` inkl. RLS + Seeds

-- =========================================================================
-- 1. Tabelle categories
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Eindeutiger Name (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_unique
  ON public.categories (lower(name));

-- Sortierung nach Name für die Verwaltungsansicht
CREATE INDEX IF NOT EXISTS idx_categories_name
  ON public.categories (name);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Policy: Alle eingeloggten Benutzer dürfen Kategorien lesen
CREATE POLICY "Eingeloggte lesen Kategorien"
  ON public.categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policy: Nur Admins dürfen Kategorien anlegen
CREATE POLICY "Admins legen Kategorien an"
  ON public.categories FOR INSERT
  WITH CHECK (public.is_admin());

-- Policy: Nur Admins dürfen Kategorien aktualisieren
CREATE POLICY "Admins aktualisieren Kategorien"
  ON public.categories FOR UPDATE
  USING (public.is_admin());

-- Policy: Nur Admins dürfen Kategorien löschen
CREATE POLICY "Admins löschen Kategorien"
  ON public.categories FOR DELETE
  USING (public.is_admin());

-- =========================================================================
-- 2. Verknüpfungstabelle transaction_categories (many-to-many)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.transaction_categories (
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (transaction_id, category_id)
);

-- Indizes für Joins und Filter
CREATE INDEX IF NOT EXISTS idx_transaction_categories_transaction_id
  ON public.transaction_categories (transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_categories_category_id
  ON public.transaction_categories (category_id);

ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Alle eingeloggten Benutzer dürfen Zuordnungen lesen
CREATE POLICY "Eingeloggte lesen Zuordnungen"
  ON public.transaction_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policy: Nur Admins dürfen Zuordnungen anlegen (auch Bulk)
CREATE POLICY "Admins legen Zuordnungen an"
  ON public.transaction_categories FOR INSERT
  WITH CHECK (public.is_admin());

-- Policy: Nur Admins dürfen Zuordnungen löschen (auch Bulk)
CREATE POLICY "Admins löschen Zuordnungen"
  ON public.transaction_categories FOR DELETE
  USING (public.is_admin());

-- =========================================================================
-- 3. Seed-Kategorien (6 Standardkategorien)
-- =========================================================================
INSERT INTO public.categories (name, color) VALUES
  ('Mitgliedsbeiträge', '#22c55e'),
  ('Spenden',           '#06b6d4'),
  ('Reisekosten',       '#f97316'),
  ('Veranstaltungen',   '#a855f7'),
  ('Büro & Betrieb',    '#64748b'),
  ('Gebühren',          '#ef4444')
ON CONFLICT (lower(name)) DO NOTHING;
