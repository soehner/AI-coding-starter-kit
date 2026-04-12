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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
} from "lucide-react"

type UploadStep = "idle" | "uploading" | "done" | "error"

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
]

const ALLOWED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

interface BelegUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionId: string
  transactionDescription: string
  hasExistingDocument: boolean
  onUploadComplete: (documentRef: string) => void
}

export function BelegUploadDialog({
  open,
  onOpenChange,
  transactionId,
  transactionDescription,
  hasExistingDocument,
  onUploadComplete,
}: BelegUploadDialogProps) {
  const [step, setStep] = useState<UploadStep>("idle")
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = useCallback(() => {
    setStep("idle")
    setError(null)
    setSelectedFile(null)
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onOpenChange(false)
  }, [resetState, onOpenChange])

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Nur PDF-, JPG- und PNG-Dateien sind erlaubt."
    }
    if (file.size > MAX_FILE_SIZE) {
      return "Datei zu groß. Maximal 10 MB erlaubt."
    }
    return null
  }, [])

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null)
      setStep("uploading")
      setUploadProgress(10)

      try {
        const formData = new FormData()
        formData.append("file", file)

        setUploadProgress(30)

        const response = await fetch(
          `/api/transactions/${transactionId}/document`,
          {
            method: "POST",
            body: formData,
          }
        )

        setUploadProgress(80)

        const data = await response.json()

        if (!response.ok) {
          setStep("error")
          setError(data.error || "Fehler beim Hochladen des Belegs.")
          return
        }

        setUploadProgress(100)
        setStep("done")
        onUploadComplete(data.document_ref)

        // Dialog nach kurzer Verzögerung schließen
        setTimeout(() => {
          handleClose()
        }, 1500)
      } catch {
        setStep("error")
        setError("Netzwerkfehler beim Hochladen. Bitte erneut versuchen.")
      }
    },
    [transactionId, onUploadComplete, handleClose]
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
    if (!selectedFile) return

    // Wenn bereits ein Beleg vorhanden ist, Bestätigung anfordern
    if (hasExistingDocument) {
      setShowReplaceConfirm(true)
      return
    }

    uploadFile(selectedFile)
  }

  function handleConfirmReplace() {
    setShowReplaceConfirm(false)
    if (selectedFile) {
      uploadFile(selectedFile)
    }
  }

  const isProcessing = step === "uploading"

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {hasExistingDocument ? "Beleg ersetzen" : "Beleg hochladen"}
            </DialogTitle>
            <DialogDescription className="line-clamp-2">
              {transactionDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Drag & Drop Zone */}
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
                isDragOver && !isProcessing
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25",
                isProcessing
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:border-primary/50"
              )}
              onDrop={isProcessing ? undefined : handleDrop}
              onDragOver={isProcessing ? undefined : handleDragOver}
              onDragLeave={isProcessing ? undefined : handleDragLeave}
              onClick={
                isProcessing ? undefined : () => fileInputRef.current?.click()
              }
              role="button"
              tabIndex={isProcessing ? -1 : 0}
              aria-label="Beleg-Datei zum Hochladen auswählen oder hierher ziehen"
              onKeyDown={(e) => {
                if (!isProcessing && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_EXTENSIONS}
                className="hidden"
                onChange={handleInputChange}
                disabled={isProcessing}
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
                {selectedFile
                  ? selectedFile.name
                  : "Beleg hierher ziehen"}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(0)} KB`
                  : "PDF, JPG oder PNG (max. 10 MB)"}
              </p>
            </div>

            {/* Fortschrittsanzeige */}
            {step === "uploading" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Beleg wird hochgeladen...
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
                <AlertDescription>Beleg erfolgreich hochgeladen.</AlertDescription>
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
              {step === "error" && (
                <Button
                  variant="outline"
                  onClick={resetState}
                  aria-label="Zurücksetzen"
                >
                  Zurücksetzen
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isProcessing}
                aria-label="Abbrechen"
              >
                <X className="mr-2 h-4 w-4" />
                Abbrechen
              </Button>
              {step !== "done" && (
                <Button
                  onClick={handleUploadClick}
                  disabled={!selectedFile || isProcessing}
                  aria-label="Beleg hochladen"
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Hochladen
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bestätigungsdialog beim Ersetzen */}
      <AlertDialog open={showReplaceConfirm} onOpenChange={setShowReplaceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beleg ersetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Für diese Buchung ist bereits ein Beleg vorhanden. Der vorhandene
              Beleg wird auf Seafile gelöscht und durch den neuen ersetzt.
              Fortfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel aria-label="Abbrechen">
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReplace}
              aria-label="Beleg ersetzen"
            >
              Ersetzen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
