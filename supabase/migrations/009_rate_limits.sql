-- PROJ-11 Bugfix (BUG-3): DB-basiertes Rate-Limiting
-- Ersetzt die bisherige In-Memory-Lösung, die auf Vercel-Serverless bei jedem
-- Cold Start zurückgesetzt wurde und damit keinen echten Schutz bot.

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  window_end timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_end ON rate_limits(window_end);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Keine RLS-Policies: Zugriff ausschließlich über Service-Role-Key (serverseitig).

-- Atomare Prüf-und-Inkrement-Funktion.
-- Gibt den neuen Zähler zurück, der mit dem max-Wert auf der Aufrufseite verglichen wird.
-- window_seconds definiert, wie lange ein Fenster gilt; nach Ablauf wird der Zähler zurückgesetzt.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key text,
  p_window_seconds integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_count integer;
BEGIN
  INSERT INTO rate_limits (key, count, window_end, updated_at)
  VALUES (p_key, 1, v_now + make_interval(secs => p_window_seconds), v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN rate_limits.window_end < v_now THEN 1
      ELSE rate_limits.count + 1
    END,
    window_end = CASE
      WHEN rate_limits.window_end < v_now THEN v_now + make_interval(secs => p_window_seconds)
      ELSE rate_limits.window_end
    END,
    updated_at = v_now
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;

-- Aufräumfunktion: Abgelaufene Einträge entfernen.
-- Kann periodisch per Cron (pg_cron) oder bei Bedarf manuell aufgerufen werden.
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_end < now() - interval '1 hour';
END;
$$;
