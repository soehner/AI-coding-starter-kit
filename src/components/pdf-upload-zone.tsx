"use client"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  AlertCircle,
  FileUp,
  Loader2,
  CheckCircle2,
  FileText,
} from "lucide-react"
import type { ParsedStatementResult } from "@/lib/types"

type UploadStep = "idle" | "uploading" | "parsing" | "done" | "error"

interface PdfUploadZoneProps {
  hasApiToken: boolean
  /**
   * Wird aufgerufen, wenn alle ausgewählten PDFs erfolgreich geparst wurden.
   * Der Caller zeigt dann eine gemeinsame Vorschau aller Kontoauszüge.
   */
  onAllParsed: (results: ParsedStatementResult[]) => void
  /**
   * true, solange oberhalb die Vorschau angezeigt wird.
   * Dann ist die Drop-Zone deaktiviert, um versehentliche Uploads
   * während der Vorschau zu verhindern.
   */
  isPreviewActive: boolean
}

const STEP_LABELS: Record<UploadStep, string> = {
  idle: "",
  uploading: "PDF wird hochgeladen...",
  parsing: "KI parst den Kontoauszug...",
  done: "Alle Kontoauszüge verarbeitet",
  error: "Fehler aufgetreten",
}

const STEP_PROGRESS: Record<UploadStep, number> = {
  idle: 0,
  uploading: 30,
  parsing: 70,
  done: 100,
  error: 0,
}

export function PdfUploadZone({
  hasApiToken,
  onAllParsed,
  isPreviewActive,
}: PdfUploadZoneProps) {
  const [step, setStep] = useState<UploadStep>("idle")
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [doneCount, setDoneCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    if (file.type !== "application/pdf") {
      return `"${file.name}": Nur PDF-Dateien sind erlaubt.`
    }
    if (file.size > 50 * 1024 * 1024) {
      return `"${file.name}": Die Datei ist zu groß (maximal 50 MB).`
    }
    return null
  }, [])

  const processQueue = useCallback(
    async (files: File[]) => {
      setError(null)
      setTotalCount(files.length)
      setDoneCount(0)

      const results: ParsedStatementResult[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setCurrentFile(file)
        setDoneCount(i + 1)
        setStep("uploading")

        try {
          const formData = new FormData()
          formData.append("file", file)

          setStep("parsing")

          const response = await fetch("/api/admin/import", {
            method: "POST",
            body: formData,
          })

          const data = await response.json()

          if (!response.ok) {
            setStep("error")
            setError(
              `"${file.name}": ${data.error || "Fehler beim Verarbeiten der PDF-Datei."}`
            )
            return
          }

          results.push(data as ParsedStatementResult)
        } catch {
          setStep("error")
          setError(
            `"${file.name}": Netzwerkfehler beim Hochladen. Bitte erneut versuchen.`
          )
          return
        }
      }

      setStep("done")
      setCurrentFile(null)
      onAllParsed(results)
    },
    [onAllParsed]
  )

  const addFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return

      const valid: File[] = []
      const errors: string[] = []
      for (const f of files) {
        const err = validateFile(f)
        if (err) errors.push(err)
        else valid.push(f)
      }

      if (errors.length > 0) {
        setError(errors.join(" "))
        setStep("error")
        return
      }

      processQueue(valid)
    },
    [validateFile, processQueue]
  )

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    addFiles(files)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    addFiles(files)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const isProcessing = step === "uploading" || step === "parsing"
  const isDisabled = !hasApiToken || isProcessing || isPreviewActive
  const showProgress = totalCount > 0 && step !== "idle"

  return (
    <div className="space-y-4">
      {!hasApiToken && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Bitte KI-API-Token in den{" "}
            <a
              href="/dashboard/einstellungen"
              className="font-medium underline underline-offset-4"
            >
              Einstellungen
            </a>{" "}
            konfigurieren, bevor PDFs importiert werden können.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-6">
          <div
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
              isDragOver && !isDisabled
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25",
              isDisabled
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:border-primary/50"
            )}
            onDrop={isDisabled ? undefined : handleDrop}
            onDragOver={isDisabled ? undefined : handleDragOver}
            onDragLeave={isDisabled ? undefined : handleDragLeave}
            onClick={
              isDisabled ? undefined : () => fileInputRef.current?.click()
            }
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            aria-label="Eine oder mehrere PDF-Dateien zum Hochladen auswählen oder hierher ziehen"
            onKeyDown={(e) => {
              if (!isDisabled && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={handleInputChange}
              disabled={isDisabled}
              aria-hidden="true"
            />

            {isProcessing ? (
              <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
            ) : step === "done" ? (
              <CheckCircle2 className="mb-4 h-10 w-10 text-green-600" />
            ) : (
              <FileUp className="mb-4 h-10 w-10 text-muted-foreground" />
            )}

            <p className="mb-1 text-sm font-medium">
              PDF-Kontoauszüge hierher ziehen
            </p>
            <p className="text-xs text-muted-foreground">
              oder klicken, um Dateien auszuwählen — auch mehrere gleichzeitig
            </p>
          </div>

          {/* Queue-Status */}
          {showProgress && (
            <div className="mt-4 flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>
                  Datei <strong>{doneCount}</strong> von{" "}
                  <strong>{totalCount}</strong>
                  {currentFile && (
                    <span className="ml-2 text-muted-foreground">
                      — {currentFile.name}
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Fortschrittsanzeige */}
          {step !== "idle" && step !== "error" && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {STEP_LABELS[step]}
                </span>
                <span className="font-medium">{STEP_PROGRESS[step]}%</span>
              </div>
              <Progress
                value={STEP_PROGRESS[step]}
                aria-label="Upload-Fortschritt"
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
