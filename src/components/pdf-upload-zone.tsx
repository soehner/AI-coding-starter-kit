"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { AlertCircle, FileUp, Loader2, Upload, CheckCircle2 } from "lucide-react"
import type { ParsedStatementResult } from "@/lib/types"

type UploadStep = "idle" | "uploading" | "parsing" | "done" | "error"

interface PdfUploadZoneProps {
  hasApiToken: boolean
  onParseComplete: (result: ParsedStatementResult) => void
}

const STEP_LABELS: Record<UploadStep, string> = {
  idle: "",
  uploading: "PDF wird hochgeladen...",
  parsing: "KI parst den Kontoauszug...",
  done: "Parsing abgeschlossen",
  error: "Fehler aufgetreten",
}

const STEP_PROGRESS: Record<UploadStep, number> = {
  idle: 0,
  uploading: 30,
  parsing: 70,
  done: 100,
  error: 0,
}

export function PdfUploadZone({ hasApiToken, onParseComplete }: PdfUploadZoneProps) {
  const [step, setStep] = useState<UploadStep>("idle")
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = useCallback(() => {
    setStep("idle")
    setError(null)
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const validateFile = useCallback((file: File): string | null => {
    if (file.type !== "application/pdf") {
      return "Nur PDF-Dateien sind erlaubt."
    }
    // 50 MB Limit
    if (file.size > 50 * 1024 * 1024) {
      return "Die Datei ist zu gross (maximal 50 MB)."
    }
    return null
  }, [])

  const uploadAndParse = useCallback(
    async (file: File) => {
      setError(null)
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
          setError(data.error || "Fehler beim Verarbeiten der PDF-Datei.")
          return
        }

        setStep("done")
        onParseComplete(data as ParsedStatementResult)
      } catch {
        setStep("error")
        setError("Netzwerkfehler beim Hochladen. Bitte erneut versuchen.")
      }
    },
    [onParseComplete]
  )

  const handleFileSelect = useCallback(
    (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        setStep("error")
        return
      }
      setSelectedFile(file)
      setError(null)
      setStep("idle")
    },
    [validateFile]
  )

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
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
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  function handleUploadClick() {
    if (selectedFile) {
      uploadAndParse(selectedFile)
    }
  }

  const isProcessing = step === "uploading" || step === "parsing"
  const isDisabled = !hasApiToken || isProcessing

  return (
    <div className="space-y-4">
      {!hasApiToken && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Bitte KI-API-Token in den{" "}
            <a
              href="/dashboard/admin/settings"
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
              isDisabled
                ? undefined
                : () => fileInputRef.current?.click()
            }
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            aria-label="PDF-Datei zum Hochladen auswählen oder hierher ziehen"
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
              {selectedFile
                ? selectedFile.name
                : "PDF-Kontoauszug hierher ziehen"}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedFile
                ? `${(selectedFile.size / 1024).toFixed(0)} KB`
                : "oder klicken, um eine Datei auszuwählen"}
            </p>
          </div>

          {/* Fortschrittsanzeige */}
          {step !== "idle" && step !== "error" && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {STEP_LABELS[step]}
                </span>
                <span className="font-medium">{STEP_PROGRESS[step]}%</span>
              </div>
              <Progress value={STEP_PROGRESS[step]} aria-label="Upload-Fortschritt" />
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action-Buttons */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleUploadClick}
              disabled={!selectedFile || isProcessing || !hasApiToken}
              className="flex-1 sm:flex-initial"
              aria-label="PDF hochladen und parsen"
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Hochladen & Parsen
            </Button>
            {(selectedFile || step === "error" || step === "done") && (
              <Button
                variant="outline"
                onClick={resetState}
                disabled={isProcessing}
                aria-label="Auswahl zurücksetzen"
              >
                Zurücksetzen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
