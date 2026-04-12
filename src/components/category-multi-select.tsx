"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { CategoryBadge } from "@/components/category-badge"
import type { Category } from "@/lib/types"

interface CategoryMultiSelectProps {
  allCategories: Category[]
  selectedIds: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  placeholder?: string
}

export function CategoryMultiSelect({
  allCategories,
  selectedIds,
  onChange,
  disabled = false,
  placeholder = "Kategorien auswählen…",
}: CategoryMultiSelectProps) {
  const [open, setOpen] = useState(false)

  const selectedCategories = selectedIds
    .map((id) => allCategories.find((c) => c.id === id))
    .filter((c): c is Category => c !== undefined)

  function toggleCategory(categoryId: string) {
    if (selectedIds.includes(categoryId)) {
      onChange(selectedIds.filter((id) => id !== categoryId))
    } else {
      onChange([...selectedIds, categoryId])
    }
  }

  function removeCategory(categoryId: string) {
    onChange(selectedIds.filter((id) => id !== categoryId))
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
              {placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Kategorie suchen…" />
            <CommandList>
              <CommandEmpty>Keine Kategorie gefunden.</CommandEmpty>
              <CommandGroup>
                {allCategories.map((cat) => {
                  const isSelected = selectedIds.includes(cat.id)
                  return (
                    <CommandItem
                      key={cat.id}
                      value={cat.name}
                      onSelect={() => toggleCategory(cat.id)}
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

      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedCategories.map((cat) => (
            <CategoryBadge
              key={cat.id}
              category={cat}
              onRemove={disabled ? undefined : () => removeCategory(cat.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
