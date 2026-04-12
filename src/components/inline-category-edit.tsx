"use client"

import { useState } from "react"
import { Check, Plus } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { CategoryBadge } from "@/components/category-badge"
import { cn } from "@/lib/utils"
import type { Category } from "@/lib/types"

interface InlineCategoryEditProps {
  transactionId: string
  categories: Category[]
  allCategories: Category[]
  canEdit: boolean
  onSave: (transactionId: string, categoryIds: string[]) => Promise<void>
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((v, i) => v === sortedB[i])
}

export function InlineCategoryEdit({
  transactionId,
  categories,
  allCategories,
  canEdit,
  onSave,
}: InlineCategoryEditProps) {
  const [open, setOpen] = useState(false)
  const [draftIds, setDraftIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const currentIds = categories.map((c) => c.id)

  function toggleDraft(id: string) {
    setDraftIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleOpenChange(next: boolean) {
    if (next) {
      setDraftIds(currentIds)
      setOpen(true)
      return
    }

    // Popover wird geschlossen – speichern, falls Auswahl geändert
    if (arraysEqual(draftIds, currentIds)) {
      setOpen(false)
      return
    }

    setIsSaving(true)
    try {
      await onSave(transactionId, draftIds)
      setOpen(false)
    } catch {
      // Fehlermeldung kommt aus dem Handler (Toast). Popover offen lassen,
      // damit der Nutzer seine Auswahl korrigieren kann.
    } finally {
      setIsSaving(false)
    }
  }

  // Schreibgeschützte Anzeige für Betrachter
  if (!canEdit) {
    if (categories.length === 0) {
      return <span className="text-xs text-muted-foreground">—</span>
    }
    return (
      <div className="flex flex-wrap gap-1">
        {categories.map((cat) => (
          <CategoryBadge key={cat.id} category={cat} />
        ))}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={isSaving}
          aria-label="Kategorien bearbeiten"
          className={cn(
            "group flex min-h-[28px] w-full flex-wrap items-center gap-1 rounded-sm px-1 py-0.5 text-left transition-colors",
            "hover:bg-muted/60 focus:bg-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            isSaving && "opacity-60"
          )}
        >
          {categories.length === 0 ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
              <Plus className="h-3 w-3" />
              Kategorie zuweisen
            </span>
          ) : (
            categories.map((cat) => (
              <CategoryBadge key={cat.id} category={cat} />
            ))
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Kategorie suchen…" />
          <CommandList>
            <CommandEmpty>
              {allCategories.length === 0
                ? "Noch keine Kategorien angelegt."
                : "Keine Kategorie gefunden."}
            </CommandEmpty>
            <CommandGroup>
              {allCategories.map((cat) => {
                const isSelected = draftIds.includes(cat.id)
                return (
                  <CommandItem
                    key={cat.id}
                    value={cat.name}
                    onSelect={() => toggleDraft(cat.id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{cat.name}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
