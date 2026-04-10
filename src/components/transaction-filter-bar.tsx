"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search } from "lucide-react"

interface TransactionFilterBarProps {
  availableYears: string[]
  selectedYear: string
  selectedMonth: string
  searchValue: string
  onYearChange: (year: string) => void
  onMonthChange: (month: string) => void
  onSearchChange: (search: string) => void
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
  onYearChange,
  onMonthChange,
  onSearchChange,
}: TransactionFilterBarProps) {
  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      role="search"
      aria-label="Buchungen filtern"
    >
      <Select value={selectedYear} onValueChange={onYearChange}>
        <SelectTrigger className="w-full sm:w-[140px]" aria-label="Jahr auswählen">
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
        <SelectTrigger className="w-full sm:w-[160px]" aria-label="Monat auswählen">
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

      <div className="relative flex-1">
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
    </div>
  )
}
