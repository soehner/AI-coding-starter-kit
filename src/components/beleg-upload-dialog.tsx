"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  AlertCircle,
  FileUp,
  Loader2,
  Upload,
  CheckCircle2,
  X,
  ExternalLink,
  Trash2,
} from "lucide-react"
import type { TransactionDocument } from "@/lib/types"

type UploadStep = "idle" | "uploading" | "done" | "error"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES_PER_TRANSACTION = 5

interface BelegUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionId: string
  transactionDescription: string
  existingDocuments: TransactionDocument[]
  onDocumentsChanged: (documents: TransactionDocument[]) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BelegUploadDialog({
  open,
  onOpenChange,
  transactionId,
  transactionDescription,
  existingDocuments,
  onDocumentsChanged,
}: BelegUploadDialogProps) {
  const [step, setStep] = useState<UploadStep>("idle")
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const existingCount = existingDocuments.length
  const remainingSlots = Math.max(0, MAX_FILES_PER_TRANSACTION - existingCount)

  const resetState = useCallback(() => {
    setStep("idle")
    setError(null)
    setSelectedFiles([])
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onOpenChange(false)
  }, [resetState, onOpenChange])

  const validateAndAddFiles = useCallback(
    (incoming: File[]) => {
      const combined = [...selectedFiles, ...incoming]

      if (combined.length > remainingSlots) {
        setError(
          `Es sind bereits ${existingCount} Belege vorhanden. Es können noch maximal ${remainingSlots} hochgeladen werden.`
        )
        setStep("error")
        return
      }

      for (const f of combined) {
        if (f.size > MAX_FILE_SIZE) {
          setError(`Die Datei "${f.name}" ist zu groß (maximal 10 MB).`)
          setStep("error")
          return
        }
      }

      setSelectedFiles(combined)
      setError(null)
      setStep("idle")
      if (fileInputRef.current) fileInputRef.current.value = ""
    },
    [selectedFiles, remainingSlots, existingCount]
  )

  const uploadFiles = useCallback(async () => {
    if (selectedFiles.length === 0) return

    setError(null)
    setStep("uploading")
    setUploadProgress(10)

    try {
      const formData = new FormData()
      for (const f of selectedFiles) {
        formData.append("files", f)
      }

      setUploadProgress(30)

      const response = await fetch(
        `/api/transactions/${transactionId}/documents`,
        {
          method: "POST",
          body: formData,
        }
      )

      setUploadProgress(80)

      const data = await response.json()

      if (!response.ok) {
        setStep("error")
        setError(data.error || "Fehler beim Hochladen der Belege.")
        return
      }

      setUploadProgress(100)
      setStep("done")

      const newDocs: TransactionDocument[] = data.documents ?? []
      onDocumentsChanged([...existingDocuments, ...newDocs])

      setTimeout(() => {
        handleClose()
      }, 1200)
    } catch {
      setStep("error")
      setError("Netzwerkfehler beim Hochladen. Bitte erneut versuchen.")
    }
  }, [
    selectedFiles,
    transactionId,
    existingDocuments,
    onDocumentsChanged,
    handleClose,
  ])

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) validateAndAddFiles(files)
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
    if (files.length > 0) validateAndAddFiles(files)
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    setError(null)
    setStep("idle")
  }

  async function handleDeleteExisting(doc: TransactionDocument) {
    setDeletingId(doc.id)
    setError(null)
    try {
      const response = await fetch(
        `/api/transactions/${transactionId}/documents/${doc.id}`,
        { method: "DELETE" }
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Beleg konnte nicht entfernt werden.")
        return
      }
      onDocumentsChanged(existingDocuments.filter((d) => d.id !== doc.id))
    } catch {
      setError("Netzwerkfehler beim Entfernen des Belegs.")
    } finally {
      setDeletingId(null)
    }
  }

  const isProcessing = step === "uploading"
  const canAddMore = remainingSlots - selectedFiles.length > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Belege verwalten</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {transactionDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bestehende Belege */}
          {existingDocuments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Vorhandene Belege ({existingDocuments.length}/
                {MAX_FILES_PER_TRANSACTION})
              </p>
              <ul className="space-y-1">
                {existingDocuments.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <a
                      href={doc.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 flex-1 items-center gap-2 truncate hover:underline"
                      aria-label={`Beleg ${doc.document_name} öffnen`}
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{doc.document_name}</span>
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteExisting(doc)}
                      disabled={deletingId === doc.id || isProcessing}
                      aria-label={`Beleg ${doc.document_name} entfernen`}
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Drag & Drop Zone */}
          {remainingSlots > 0 && (
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
                isDragOver && !isProcessing && canAddMore
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25",
                !canAddMore || isProcessing
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:border-primary/50"
              )}
              onDrop={
                isProcessing || !canAddMore ? undefined : handleDrop
              }
              onDragOver={
                isProcessing || !canAddMore ? undefined : handleDragOver
              }
              onDragLeave={
                isProcessing || !canAddMore ? undefined : handleDragLeave
              }
              onClick={
                isProcessing || !canAddMore
                  ? undefined
                  : () => fileInputRef.current?.click()
              }
              role="button"
              tabIndex={isProcessing || !canAddMore ? -1 : 0}
              aria-label="Belege zum Hochladen auswählen oder hierher ziehen"
              onKeyDown={(e) => {
                if (
                  !isProcessing &&
                  canAddMore &&
                  (e.key === "Enter" || e.key === " ")
                ) {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleInputChange}
                disabled={isProcessing || !canAddMore}
                aria-hidden="true"
              />

              {isProcessing ? (
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
              ) : step === "done" ? (
                <CheckCircle2 className="mb-3 h-8 w-8 text-green-600" />
              ) : (
                <FileUp className="mb-3 h-8 w-8 text-muted-foreground" />
              )}

              <p className="mb-1 text-sm font-medium">
                Belege hierher ziehen oder klicken
              </p>
              <p className="text-xs text-muted-foreground">
                Bis zu {MAX_FILES_PER_TRANSACTION} Dateien, jeweils max. 10 MB
              </p>
            </div>
          )}

          {/* Neu ausgewählte Dateien */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Zum Hochladen bereit ({selectedFiles.length})
              </p>
              <ul className="space-y-1">
                {selectedFiles.map((f, index) => (
                  <li
                    key={`${f.name}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(f.size)}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeSelectedFile(index)}
                      disabled={isProcessing}
                      aria-label={`${f.name} entfernen`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fortschrittsanzeige */}
          {step === "uploading" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Belege werden hochgeladen...
                </span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress
                value={uploadProgress}
                aria-label="Upload-Fortschritt"
              />
            </div>
          )}

          {step === "done" && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Belege erfolgreich hochgeladen.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
              aria-label="Schließen"
            >
              <X className="mr-2 h-4 w-4" />
              Schließen
            </Button>
            {selectedFiles.length > 0 && step !== "done" && (
              <Button
                onClick={uploadFiles}
                disabled={isProcessing}
                aria-label="Belege hochladen"
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Hochladen ({selectedFiles.length})
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
