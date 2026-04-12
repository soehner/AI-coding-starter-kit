-- PROJ-10 Erweiterung: Mehrere Belege pro Genehmigungsantrag
-- Verschiebt document_url/document_name/document_path aus approval_requests
-- in eine eigene Tabelle approval_documents (1:n).

-- ============================================================
-- 1. Neue Tabelle approval_documents
-- ============================================================
CREATE TABLE IF NOT EXISTS public.approval_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  document_url text NOT NULL,
  document_name text NOT NULL,
  document_path text,
  display_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_documents ENABLE ROW LEVEL SECURITY;

-- Eingeloggte Benutzer dürfen Dokumente lesen (wie die Anträge)
CREATE POLICY "Eingeloggte sehen Antragsdokumente"
  ON public.approval_documents
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert/Update/Delete läuft ausschließlich über den Service-Role-Client.

CREATE INDEX IF NOT EXISTS idx_approval_documents_request
  ON public.approval_documents(request_id);

CREATE INDEX IF NOT EXISTS idx_approval_documents_order
  ON public.approval_documents(request_id, display_order);

-- ============================================================
-- 2. Backfill: Bestehende Dokumente aus approval_requests kopieren
-- ============================================================
INSERT INTO public.approval_documents (request_id, document_url, document_name, document_path, display_order)
SELECT id, document_url, document_name, document_path, 0
FROM public.approval_requests
WHERE document_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.approval_documents d WHERE d.request_id = approval_requests.id
  );

-- ============================================================
-- 3. Spalten auf approval_requests nullable machen (für Kompatibilität)
-- ============================================================
ALTER TABLE public.approval_requests
  ALTER COLUMN document_url DROP NOT NULL,
  ALTER COLUMN document_name DROP NOT NULL;
