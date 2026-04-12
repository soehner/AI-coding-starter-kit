"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { PdfUploadZone } from "@/components/pdf-upload-zone"
import {
  MultiStatementPreview,
  type StatementConfirmation,
} from "@/components/multi-statement-preview"
import { ImportedStatementsList } from "@/components/imported-statements-list"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import type { BankStatement, ParsedStatementResult } from "@/lib/types"

export default function AdminImportPage() {
  const { user, profile, isLoading: authLoading, hasPermission } = useAuth()
  const router = useRouter()

  const [hasApiToken, setHasApiToken] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [parseResults, setParseResults] = useState<ParsedStatementResult[] | null>(
    null
  )
  const [statements, setStatements] = useState<BankStatement[]>([])
  const [isLoadingStatements, setIsLoadingStatements] = useState(true)
  const [statementsError, setStatementsError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [seafileWarning, setSeafileWarning] = useState<string | null>(null)

  // KI-Einstellungen prüfen
  const checkSettings = useCallback(async () => {
    setIsLoadingSettings(true)
    try {
      const response = await fetch("/api/admin/settings")
      if (response.ok) {
        const data = await response.json()
        setHasApiToken(data.hasToken || false)
      }
    } catch {
      // Token-Status bleibt false
    } finally {
      setIsLoadingSettings(false)
    }
  }, [])

  // Importierte Kontoauszüge laden
  const fetchStatements = useCallback(async () => {
    setIsLoadingStatements(true)
    setStatementsError(null)

    try {
      const response = await fetch("/api/admin/import/statements")
      const data = await response.json()

      if (!response.ok) {
        setStatementsError(
          data.error || "Kontoauszüge konnten nicht geladen werden."
        )
        return
      }

      setStatements(data as BankStatement[])
    } catch {
      setStatementsError("Netzwerkfehler beim Laden der Kontoauszüge.")
    } finally {
      setIsLoadingStatements(false)
    }
  }, [])

  const canImport = hasPermission("import_statements")

  // Redirect falls keine Import-Berechtigung
  useEffect(() => {
    if (!authLoading && (!profile || !canImport)) {
      router.replace("/dashboard")
    }
  }, [authLoading, profile, canImport, router])

  // Daten laden wenn berechtigt
  useEffect(() => {
    if (canImport) {
      checkSettings()
      fetchStatements()
    }
  }, [canImport, checkSettings, fetchStatements])

  // Lade-Zustand
  if (authLoading || isLoadingSettings) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="mb-4 h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Nicht berechtigt: nichts anzeigen (Redirect passiert im useEffect)
  if (!canImport || !user) {
    return null
  }

  function handleAllParsed(results: ParsedStatementResult[]) {
    setParseResults(results)
    setSaveSuccess(null)

    // Falls einzelne Statements einen Seafile-Fehler hatten, gesammelt anzeigen
    const warnings = results
      .map((r) => r.seafile_warning)
      .filter((w): w is string => !!w)
    setSeafileWarning(warnings.length > 0 ? warnings.join(" | ") : null)
  }

  async function handleConfirmSingle({ result, transactions }: StatementConfirmation) {
    const response = await fetch("/api/admin/import/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statement_number: result.statement_number,
        statement_date: result.statement_date,
        file_name: result.file_name,
        file_path: result.file_path,
        start_balance: result.start_balance,
        end_balance: result.end_balance,
        transactions,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(
        data.error || "Fehler beim Speichern der Buchungen."
      )
    }
  }

  function handleAllSaved(savedCount: number, transactionCount: number) {
    setParseResults(null)
    setSaveSuccess(
      `${transactionCount} Buchungen aus ${savedCount} ${
        savedCount === 1 ? "Kontoauszug" : "Kontoauszügen"
      } erfolgreich gespeichert.`
    )
    fetchStatements()
  }

  function handleCancel() {
    setParseResults(null)
  }

  const previewActive = !!parseResults

  return (
    <div className="container px-4 py-8 md:px-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">
          Kontoauszug importieren
        </h2>
        <p className="text-sm text-muted-foreground">
          PDF-Kontoauszüge der Badischen Beamtenbank hochladen und automatisch
          parsen lassen.
        </p>
      </div>

      {saveSuccess && (
        <Alert className="mb-6">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{saveSuccess}</AlertDescription>
        </Alert>
      )}

      {seafileWarning && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Seafile-Upload fehlgeschlagen:</strong> {seafileWarning}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-8">
        {/* Upload-Bereich — während der Vorschau ausgeblendet */}
        <div className={previewActive ? "hidden" : ""}>
          <PdfUploadZone
            hasApiToken={hasApiToken}
            onAllParsed={handleAllParsed}
            isPreviewActive={previewActive}
          />
        </div>

        {/* Gesammelte Vorschau aller geparsten Kontoauszüge */}
        {parseResults && (
          <MultiStatementPreview
            results={parseResults}
            onConfirmSingle={handleConfirmSingle}
            onAllSaved={handleAllSaved}
            onCancel={handleCancel}
          />
        )}

        {/* Importierte Kontoauszüge */}
        <ImportedStatementsList
          statements={statements}
          isLoading={isLoadingStatements}
          error={statementsError}
        />
      </div>
    </div>
  )
}
