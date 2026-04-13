-- ============================================================
-- PROJ-16 Nachtrag: Umstellung von GoCardless auf Enable Banking
-- + Fix K1 (get_current_balance respektiert PSD2-Einträge)
-- + Vorbereitung M2 (CSRF-State-Token)
-- Datum: 2026-04-13
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabelle psd2_verbindungen auf Enable Banking umstellen
-- ------------------------------------------------------------

-- Spalten umbenennen (GoCardless → Enable Banking)
ALTER TABLE public.psd2_verbindungen
  RENAME COLUMN gocardless_requisition_id TO enablebanking_session_id;

ALTER TABLE public.psd2_verbindungen
  RENAME COLUMN gocardless_account_id TO enablebanking_account_id;

-- session_id darf erst nach erfolgreicher Authorisierung gesetzt werden.
ALTER TABLE public.psd2_verbindungen
  ALTER COLUMN enablebanking_session_id DROP NOT NULL;

-- institution_id wird nicht mehr verwendet — durch aspsp_name/country ersetzt.
ALTER TABLE public.psd2_verbindungen
  ALTER COLUMN institution_id DROP NOT NULL;

-- Neue Spalten für Enable Banking
ALTER TABLE public.psd2_verbindungen
  ADD COLUMN IF NOT EXISTS enablebanking_authorization_id text,
  ADD COLUMN IF NOT EXISTS enablebanking_aspsp_name text NOT NULL DEFAULT 'BBBank',
  ADD COLUMN IF NOT EXISTS enablebanking_aspsp_country text NOT NULL DEFAULT 'DE',
  ADD COLUMN IF NOT EXISTS state_token text,
  ADD COLUMN IF NOT EXISTS state_token_erstellt_am timestamptz;

-- Index auf state_token für Callback-Lookup
CREATE INDEX IF NOT EXISTS idx_psd2_verbindungen_state_token
  ON public.psd2_verbindungen(state_token)
  WHERE state_token IS NOT NULL;


-- ------------------------------------------------------------
-- 2. Fix K1: get_current_balance respektiert PSD2-Einträge
--
-- Bisher: Zeitlich letzter balance_after (PSD2 schreibt 0 → Saldo 0).
-- Neu:    Letzter PDF-gestützter Saldo (quelle IN ('pdf','beide'),
--         balance_after IS NOT NULL) + Summe aller danach liegenden
--         Transaktionen (alle Quellen, inkl. PSD2).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_balance(
  p_category_filter uuid[] DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_category_filter IS NULL THEN
      -- Uneingeschränkt: letzter PDF-Saldo + alle späteren Bewegungen
      COALESCE(
        (
          WITH letzter_pdf AS (
            SELECT t.id, t.booking_date, t.created_at, t.balance_after
            FROM public.transactions t
            WHERE t.quelle IN ('pdf','beide')
              AND t.balance_after IS NOT NULL
            ORDER BY t.booking_date DESC, t.created_at DESC
            LIMIT 1
          )
          SELECT
            (SELECT balance_after FROM letzter_pdf)
            + COALESCE(
                (
                  SELECT SUM(t.amount)
                  FROM public.transactions t, letzter_pdf l
                  WHERE (t.booking_date, t.created_at)
                        > (l.booking_date, l.created_at)
                ),
                0
              )
          FROM letzter_pdf
        ),
        -- Fallback, wenn noch kein PDF importiert wurde:
        -- Summe aller Transaktionsbeträge (reiner PSD2-Betrieb).
        (
          SELECT COALESCE(SUM(t.amount), 0)
          FROM public.transactions t
        )
      )
    ELSE
      -- Eingeschränkt: Summe der Beträge der SICHTBAREN Buchungen
      -- (virtueller Saldo, kein Leak des Realsaldos).
      COALESCE(
        (
          SELECT SUM(t.amount)
          FROM public.transactions t
          WHERE EXISTS (
            SELECT 1 FROM public.transaction_categories tc
            WHERE tc.transaction_id = t.id
              AND tc.category_id = ANY(p_category_filter)
          )
        ),
        0
      )
  END;
$$;

REVOKE ALL ON FUNCTION public.get_current_balance(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_balance(uuid[]) TO authenticated;


-- ------------------------------------------------------------
-- 3. Schema-Cache neu laden
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
