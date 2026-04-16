"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ChevronsUpDown, Search, Tags, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Category } from "@/lib/types"

export const UNCATEGORIZED_FILTER_VALUE = "__uncategorized__"

interface TransactionFilterBarProps {
  availableYears: string[]
  selectedYear: string
  selectedMonth: string
  searchValue: string
  allCategories: Category[]
  selectedCategoryFilter: string[]
  /** PROJ-16: Nur unbestätigte Abgleich-Einträge anzeigen. */
  onlyUnconfirmed?: boolean
  /** PROJ-16: Wird nur gerendert, wenn der Benutzer die Toggle sehen soll. */
  showUnconfirmedToggle?: boolean
  onYearChange: (year: string) => void
  onMonthChange: (month: string) => void
  onSearchChange: (search: string) => void
  onCategoryFilterChange: (values: string[]) => void
  onOnlyUnconfirmedChange?: (value: boolean) => void
}

const MONTHS = [
  { value: "all", label: "Alle Monate" },
  { value: "1", label: "Januar" },
  { value: "2", label: "Februar" },
  { value: "3", label: "März" },
  { value: "4", label: "April" },
  { value: "5", label: "Mai" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Dezember" },
]

export function TransactionFilterBar({
  availableYears,
  selectedYear,
  selectedMonth,
  searchValue,
  allCategories,
  selectedCategoryFilter,
  onlyUnconfirmed = false,
  showUnconfirmedToggle = false,
  onYearChange,
  onMonthChange,
  onSearchChange,
  onCategoryFilterChange,
  onOnlyUnconfirmedChange,
}: TransactionFilterBarProps) {
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)

  function toggleFilter(value: string) {
    if (selectedCategoryFilter.includes(value)) {
      onCategoryFilterChange(selectedCategoryFilter.filter((v) => v !== value))
    } else {
      onCategoryFilterChange([...selectedCategoryFilter, value])
    }
  }

  const filterLabel =
    selectedCategoryFilter.length === 0
      ? "Alle Kategorien"
      : `${selectedCategoryFilter.length} ausgewählt`

  return (
    <div
      className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center"
      role="search"
      aria-label="Buchungen filtern"
    >
      <Select value={selectedYear} onValueChange={onYearChange}>
        <SelectTrigger className="w-full md:w-[140px]" aria-label="Jahr auswählen">
          <SelectValue placeholder="Alle Jahre" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle Jahre</SelectItem>
          {availableYears.map((year) => (
            <SelectItem key={year} value={year}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedMonth} onValueChange={onMonthChange}>
        <SelectTrigger className="w-full md:w-[160px]" aria-label="Monat auswählen">
          <SelectValue placeholder="Alle Monate" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={categoryPopoverOpen}
            aria-label="Nach Kategorie filtern"
            className={cn(
              "w-full justify-between font-normal md:w-[200px]",
              selectedCategoryFilter.length === 0 && "text-muted-foreground"
            )}
          >
            <span className="flex items-center gap-1.5 truncate">
              <Tags className="h-3.5 w-3.5 shrink-0" />
              {filterLabel}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[280px] max-w-[calc(100vw-2rem)] p-0"
          align="start"
        >
          <div className="max-h-[300px] overflow-auto p-1">
            <button
              type="button"
              onClick={() => toggleFilter(UNCATEGORIZED_FILTER_VALUE)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={selectedCategoryFilter.includes(UNCATEGORIZED_FILTER_VALUE)}
                aria-hidden="true"
                tabIndex={-1}
              />
              <span className="italic text-muted-foreground">Ohne Kategorie</span>
            </button>
            {allCategories.length === 0 ? (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                Noch keine Kategorien angelegt.
              </div>
            ) : (
              allCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleFilter(cat.id)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedCategoryFilter.includes(cat.id)}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{cat.name}</span>
                </button>
              ))
            )}
          </div>
          {selectedCategoryFilter.length > 0 && (
            <div className="border-t p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => onCategoryFilterChange([])}
              >
                Auswahl zurücksetzen
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <div className="relative w-full flex-1 md:min-w-[220px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          placeholder="Buchungstext suchen..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          aria-label="Buchungstext suchen"
        />
      </div>

      {showUnconfirmedToggle && onOnlyUnconfirmedChange && (
        <Button
          type="button"
          variant={onlyUnconfirmed ? "default" : "outline"}
          size="sm"
          onClick={() => onOnlyUnconfirmedChange(!onlyUnconfirmed)}
          aria-pressed={onlyUnconfirmed}
          aria-label="Nur unbestätigte Abgleich-Einträge anzeigen"
          className="w-full md:w-auto"
        >
          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
          Nur unbestätigte
        </Button>
      )}

      {selectedCategoryFilter.length > 0 && (
        <div className="hidden w-full flex-wrap gap-1 md:flex">
          {selectedCategoryFilter.map((value) => {
            if (value === UNCATEGORIZED_FILTER_VALUE) {
              return (
                <Badge
                  key={value}
                  variant="secondary"
                  className="cursor-pointer italic"
                  onClick={() => toggleFilter(value)}
                >
                  Ohne Kategorie ×
                </Badge>
              )
            }
            const cat = allCategories.find((c) => c.id === value)
            if (!cat) return null
            return (
              <Badge
                key={value}
                variant="outline"
                className="cursor-pointer"
                style={{ borderColor: cat.color, color: cat.color }}
                onClick={() => toggleFilter(value)}
              >
                {cat.name} ×
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
