"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { cn } from "@/lib/utils"
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react"
import {
  approvalRequestSchema,
  validateApprovalFile,
  type ApprovalRequestInput,
} from "@/lib/validations/approval"
import type { ApprovalRequestWithDecisions, ApprovalRoleType } from "@/lib/types"

interface GenehmigungResubmitDialogProps {
  request: ApprovalRequestWithDecisions
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const ROLE_LABELS: Record<ApprovalRoleType, string> = {
  vorstand: "Vorstand",
  zweiter_vorstand: "2. Vorstand",
}

export function GenehmigungResubmitDialog({
  request,
  open,
  onOpenChange,
  onSuccess,
}: GenehmigungResubmitDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const MAX_FILES = 10

  const form = useForm<ApprovalRequestInput>({
    resolver: zodResolver(approvalRequestSchema),
    defaultValues: {
      note: request.note,
      required_roles: request.required_roles,
      link_type: request.link_type,
    },
  })

  // Formular beim Öffnen mit den Antragsdaten füllen
  useEffect(() => {
    if (open) {
      form.reset({
        note: request.note,
        required_roles: request.required_roles,
        link_type: request.link_type,
      })
      setNewFiles([])
      setError(null)
      setFileError(null)
    }
  }, [open, request, form])

  const addFiles = useCallback((incoming: File[]) => {
    if (incoming.length === 0) return
    setNewFiles((prev) => {
      const combined = [...prev]
      for (const file of incoming) {
        if (combined.length >= MAX_FILES) {
          setFileError(`Maximal ${MAX_FILES} Belege pro Antrag.`)
          break
        }
        const validationError = validateApprovalFile(file)
        if (validationError) {
          setFileError(`${file.name}: ${validationError}`)
          continue
        }
        const isDuplicate = combined.some(
          (f) => f.name === file.name && f.size === file.size
        )
        if (isDuplicate) continue
        combined.push(file)
        setFileError(null)
      }
      return combined
    })
  }, [])

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) addFiles(files)
  }

  function removeFile(index: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== index))
    setFileError(null)
  }

  async function onSubmit(values: ApprovalRequestInput) {
    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("note", values.note)
      formData.append("required_roles", JSON.stringify(values.required_roles))
      formData.append("link_type", values.link_type)
      for (const file of newFiles) {
        formData.append("files", file)
      }

      const response = await fetch(`/api/approvals/${request.id}/resubmit`, {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Antrag konnte nicht erneut eingereicht werden.")
        return
      }

      onSuccess()
      onOpenChange(false)
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedRoles = form.watch("required_roles")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Antrag überarbeiten & erneut einreichen</DialogTitle>
          <DialogDescription>
            Du kannst Bemerkung, Rollen und Beleg anpassen. Alle bisherigen
            Entscheidungen werden zurückgesetzt und die Genehmiger erhalten
            eine neue E-Mail.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Aktuelle Belege + Upload-Feld */}
            <div className="space-y-2">
              <Label>Belege</Label>

              {request.documents.length > 0 && newFiles.length === 0 && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                  <p className="text-xs text-muted-foreground">Aktuell:</p>
                  <ul className="space-y-1">
                    {request.documents.map((doc) => (
                      <li key={doc.id}>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-primary underline underline-offset-4"
                        >
                          {doc.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {newFiles.length > 0 && (
                <ul className="space-y-2">
                  {newFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        aria-label={`${file.name} entfernen`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                  <li className="text-xs text-muted-foreground">
                    Die neuen Belege ersetzen die bisherigen vollständig.
                  </li>
                </ul>
              )}

              {newFiles.length < MAX_FILES && (
                <div
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-sm transition-colors cursor-pointer hover:border-primary/50",
                    isDragOver
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragOver(true)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    setIsDragOver(false)
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Neue Belege hochladen"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      if (files.length > 0) addFiles(files)
                      if (fileInputRef.current) fileInputRef.current.value = ""
                    }}
                  />
                  <FileUp className="mb-1 h-5 w-5 text-muted-foreground" />
                  <p className="text-xs">
                    Optional: Neue Belege hochladen (ersetzen die bisherigen)
                  </p>
                </div>
              )}

              {fileError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{fileError}</AlertDescription>
                </Alert>
              )}
            </div>

            {/* Bemerkung */}
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bemerkung *</FormLabel>
                  <FormControl>
                    <Textarea rows={4} disabled={isSubmitting} {...field} />
                  </FormControl>
                  <FormDescription>
                    {field.value.length}/2000 Zeichen
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rollen */}
            <FormField
              control={form.control}
              name="required_roles"
              render={() => (
                <FormItem>
                  <FormLabel>Genehmiger-Rollen *</FormLabel>
                  <div className="space-y-2">
                    {(Object.entries(ROLE_LABELS) as [ApprovalRoleType, string][]).map(
                      ([role, label]) => (
                        <FormField
                          key={role}
                          control={form.control}
                          name="required_roles"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value.includes(role)}
                                  onCheckedChange={(checked) => {
                                    const updated = checked
                                      ? [...field.value, role]
                                      : field.value.filter((r) => r !== role)
                                    field.onChange(updated)
                                  }}
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                {label}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      )
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Verknüpfung */}
            {selectedRoles.length > 1 && (
              <FormField
                control={form.control}
                name="link_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verknüpfung</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isSubmitting}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="und" id="resubmit-link-und" />
                          <label htmlFor="resubmit-link-und" className="text-sm cursor-pointer">
                            <span className="font-medium">UND</span> — alle müssen genehmigen
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="oder" id="resubmit-link-oder" />
                          <label htmlFor="resubmit-link-oder" className="text-sm cursor-pointer">
                            <span className="font-medium">ODER</span> — eine Genehmigung reicht
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Erneut einreichen
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
