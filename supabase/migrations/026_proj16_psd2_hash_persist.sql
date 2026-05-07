-- ============================================================
-- PROJ-16 / Bugfix: PSD2-Hash bei Merge persistieren
--
-- Problem: Beim Zusammenführen eines PDF- mit einem PSD2-Eintrag
-- (manueller "Als identisch abgleichen" oder PDF-Import-Match)
-- wurde bisher nur der PDF-Hash in `matching_hash` behalten. Der
-- PSD2-Hash ging mit dem gelöschten PSD2-Eintrag verloren. Beim
-- nächsten PSD2-Sync fand der Duplikat-Check den abgeglichenen
-- Eintrag nicht und legte ein Duplikat an.
--
-- Lösung: Zusätzliche Spalte `matching_hash_psd2`, die den
-- ursprünglichen PSD2-Hash bei abgeglichenen Einträgen behält.
-- Der PSD2-Sync prüft beide Spalten; doppelte Imports werden
-- so zuverlässig erkannt.
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS matching_hash_psd2 text;

-- Nicht UNIQUE: Bei Konflikten/Vorschlägen kann derselbe PSD2-Hash
-- theoretisch in mehreren Einträgen auftauchen, bevor der Nutzer
-- entscheidet. Index dient nur der schnellen Suche im Sync.
CREATE INDEX IF NOT EXISTS idx_transactions_matching_hash_psd2
  ON public.transactions(matching_hash_psd2)
  WHERE matching_hash_psd2 IS NOT NULL;

COMMENT ON COLUMN public.transactions.matching_hash_psd2 IS
  'PSD2-spezifischer Hash, der beim Merge eines PDF- mit einem PSD2-Eintrag erhalten bleibt. Wird vom PSD2-Sync zusätzlich zu matching_hash zur Duplikat-Erkennung herangezogen.';
