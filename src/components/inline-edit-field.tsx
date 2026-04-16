"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

interface InlineEditFieldProps {
  value: string
  onSave: (newValue: string) => Promise<void>
  canEdit: boolean
  multiline?: boolean
  maxLength?: number
  required?: boolean
  placeholder?: string
  className?: string
  /** Wird als aria-label für das Eingabefeld verwendet */
  label: string
  /** Wenn true, wird der Anzeige-Text mehrzeilig umgebrochen statt
   *  mit Ellipsis auf eine Zeile zu kürzen. Nützlich für lange
   *  Buchungstexte in Tabellenzellen mit begrenzter Breite. */
  wrapText?: boolean
}

export function InlineEditField({
  value,
  onSave,
  canEdit,
  multiline = false,
  maxLength,
  required = false,
  placeholder = "-",
  className,
  label,
  wrapText = false,
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // Wenn sich der externe Wert ändert (z. B. durch Optimistic Rollback), synchronisieren
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value)
    }
  }, [value, isEditing])

  // Fokus auf das Eingabefeld setzen, wenn der Bearbeitungsmodus startet
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      // Cursor ans Ende setzen
      const len = editValue.length
      inputRef.current.setSelectionRange(len, len)
    }
  }, [isEditing, editValue.length])

  const validate = useCallback(
    (val: string): string | null => {
      if (required && val.trim() === "") {
        return "Buchungstext darf nicht leer sein"
      }
      if (maxLength && val.length > maxLength) {
        return `Maximal ${maxLength} Zeichen erlaubt`
      }
      return null
    },
    [required, maxLength]
  )

  const handleSave = useCallback(async () => {
    const trimmedValue = editValue.trim()
    const error = validate(trimmedValue)

    if (error) {
      setValidationError(error)
      return
    }

    // Keine Änderung - einfach schließen
    if (trimmedValue === value) {
      setIsEditing(false)
      setValidationError(null)
      return
    }

    setIsSaving(true)
    setValidationError(null)

    try {
      await onSave(trimmedValue)
      setIsEditing(false)
    } catch {
      // Fehlerbehandlung erfolgt im übergeordneten Component (Toast)
      // Feld bleibt editierbar
    } finally {
      setIsSaving(false)
    }
  }, [editValue, value, validate, onSave])

  const handleCancel = useCallback(() => {
    setEditValue(value)
    setIsEditing(false)
    setValidationError(null)
  }, [value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        handleCancel()
      }
      if (e.key === "Enter" && !multiline) {
        e.preventDefault()
        handleSave()
      }
      // Bei Textarea: Ctrl+Enter oder Cmd+Enter zum Speichern
      if (e.key === "Enter" && multiline && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSave()
      }
    },
    [handleCancel, handleSave, multiline]
  )

  // Anzeige-Modus (nicht editierbar)
  if (!canEdit) {
    return (
      <span
        className={cn(
          "block text-sm",
          wrapText ? "whitespace-normal break-words" : "truncate",
          !value && "text-muted-foreground",
          className
        )}
        title={value || undefined}
      >
        {value || placeholder}
      </span>
    )
  }

  // Bearbeitungsmodus
  if (isEditing) {
    const charCount = maxLength ? editValue.length : null

    return (
      <div className="relative space-y-1">
        {multiline ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value)
              setValidationError(null)
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            aria-label={label}
            aria-invalid={!!validationError}
            aria-describedby={validationError ? `${label}-error` : undefined}
            className={cn(
              "min-h-[60px] text-sm",
              validationError && "border-destructive",
              isSaving && "opacity-50"
            )}
            rows={3}
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value)
              setValidationError(null)
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            aria-label={label}
            aria-invalid={!!validationError}
            aria-describedby={validationError ? `${label}-error` : undefined}
            className={cn(
              "h-7 text-sm",
              validationError && "border-destructive",
              isSaving && "opacity-50"
            )}
          />
        )}

        {/* Zeichenzähler */}
        {charCount !== null && (
          <span
            className={cn(
              "text-xs",
              charCount > maxLength! ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {charCount}/{maxLength}
          </span>
        )}

        {/* Validierungsfehler */}
        {validationError && (
          <p
            id={`${label}-error`}
            className="text-xs text-destructive"
            role="alert"
          >
            {validationError}
          </p>
        )}
      </div>
    )
  }

  // Anzeige-Modus (editierbar - klickbar)
  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className={cn(
        "group flex w-full gap-1 rounded px-1 py-0.5 text-left text-sm transition-colors hover:bg-muted/50",
        wrapText ? "items-start" : "items-center",
        !value && "text-muted-foreground",
        className
      )}
      title={`${value || placeholder} — Klicken zum Bearbeiten`}
      aria-label={`${label} bearbeiten: ${value || "leer"}`}
    >
      <span
        className={cn(
          "flex-1",
          wrapText ? "whitespace-normal break-words" : "truncate"
        )}
      >
        {value || placeholder}
      </span>
      <Pencil
        className={cn(
          "h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100",
          wrapText && "mt-1"
        )}
        aria-hidden="true"
      />
    </button>
  )
}
