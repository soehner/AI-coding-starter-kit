"use client"

import { useState, useRef, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { AlertCircle, FileUp, Loader2, Send, X, CheckCircle2 } from "lucide-react"
import {
  approvalRequestSchema,
  validateApprovalFile,
  type ApprovalRequestInput,
} from "@/lib/validations/approval"
import type { ApprovalRoleType } from "@/lib/types"

interface GenehmigungsFormularProps {
  onSuccess: () => void
}

const ROLE_LABELS: Record<ApprovalRoleType, string> = {
  vorstand: "Vorstand",
  zweiter_vorstand: "2. Vorstand",
}

export function GenehmigungsFormular({ onSuccess }: GenehmigungsFormularProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<ApprovalRequestInput>({
    resolver: zodResolver(approvalRequestSchema),
    defaultValues: {
      note: "",
      required_roles: [],
      link_type: "und",
    },
  })

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateApprovalFile(file)
    if (validationError) {
      setFileError(validationError)
      setSelectedFile(null)
      return
    }
    setFileError(null)
    setSelectedFile(file)
  }, [])

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
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
    if (file) handleFileSelect(file)
  }

  function removeFile() {
    setSelectedFile(null)
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function onSubmit(values: ApprovalRequestInput) {
    if (!selectedFile) {
      setFileError("Bitte einen Beleg hochladen.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("note", values.note)
      formData.append("required_roles", JSON.stringify(values.required_roles))
      formData.append("link_type", values.link_type)

      const response = await fetch("/api/admin/approvals", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Antrag konnte nicht erstellt werden.")
        return
      }

      onSuccess()
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedRoles = form.watch("required_roles")

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Beleg-Upload */}
        <div className="space-y-2">
          <Label>Beleg *</Label>
          <Card>
            <CardContent className="p-4">
              {selectedFile ? (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removeFile}
                    aria-label="Datei entfernen"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
                    isDragOver
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25",
                    "cursor-pointer hover:border-primary/50"
                  )}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Beleg-Datei auswählen oder hierher ziehen"
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
                    className="hidden"
                    onChange={handleInputChange}
                    aria-hidden="true"
                  />
                  <FileUp className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Beleg hierher ziehen</p>
                  <p className="text-xs text-muted-foreground">
                    oder klicken — PDF, JPG, PNG, HEIC, DOC, DOCX (max. 10 MB)
                  </p>
                </div>
              )}

              {fileError && (
                <Alert variant="destructive" className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{fileError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bemerkung */}
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bemerkung *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Beschreibe den Antrag (z.B. Zweck der Ausgabe, Betrag, Hintergrund)..."
                  rows={4}
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {field.value.length}/2000 Zeichen
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Rollenauswahl */}
        <FormField
          control={form.control}
          name="required_roles"
          render={() => (
            <FormItem>
              <FormLabel>Genehmiger-Rollen *</FormLabel>
              <FormDescription>
                Wähle aus, welche Rollen genehmigen müssen.
              </FormDescription>
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

        {/* UND/ODER-Verknüpfung (nur anzeigen, wenn mehrere Rollen gewählt) */}
        {selectedRoles.length > 1 && (
          <FormField
            control={form.control}
            name="link_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Verknüpfung</FormLabel>
                <FormDescription>
                  Bestimme, ob alle oder nur eine Rolle genehmigen muss.
                </FormDescription>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="und" id="link-und" />
                      <label htmlFor="link-und" className="text-sm cursor-pointer">
                        <span className="font-medium">UND</span> — alle ausgewählten Rollen müssen genehmigen
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="oder" id="link-oder" />
                      <label htmlFor="link-oder" className="text-sm cursor-pointer">
                        <span className="font-medium">ODER</span> — eine Genehmigung reicht aus
                      </label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Fehleranzeige */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Absenden */}
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Antrag stellen
        </Button>
      </form>
    </Form>
  )
}
