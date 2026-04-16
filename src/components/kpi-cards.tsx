"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Wallet } from "lucide-react"

interface KpiCardsProps {
  currentBalance: number
  totalIncome: number
  totalExpenses: number
  isLoading: boolean
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

export function KpiCards({
  currentBalance,
  totalIncome,
  totalExpenses,
  isLoading,
}: KpiCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3" role="status" aria-label="Kennzahlen werden geladen">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3" aria-label="Finanz-Kennzahlen">
      <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-primary/40" aria-hidden="true" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground md:text-sm">
            Aktueller Kontostand
          </CardTitle>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
        </CardHeader>
        <CardContent>
          <p
            className={`text-xl font-bold md:text-2xl ${
              currentBalance >= 0 ? "text-foreground" : "text-destructive"
            }`}
            aria-label={`Aktueller Kontostand: ${formatCurrency(currentBalance)}`}
          >
            {formatCurrency(currentBalance)}
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-card shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-500/40" aria-hidden="true" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground md:text-sm">
            Einnahmen (Zeitraum)
          </CardTitle>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
            <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          </div>
        </CardHeader>
        <CardContent>
          <p
            className="text-xl font-bold text-emerald-600 md:text-2xl"
            aria-label={`Einnahmen: ${formatCurrency(totalIncome)}`}
          >
            {formatCurrency(totalIncome)}
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-rose-500/20 bg-gradient-to-br from-rose-500/5 via-card to-card shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 to-rose-500/40" aria-hidden="true" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground md:text-sm">
            Ausgaben (Zeitraum)
          </CardTitle>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10">
            <TrendingDown className="h-4 w-4 text-rose-600" aria-hidden="true" />
          </div>
        </CardHeader>
        <CardContent>
          <p
            className="text-xl font-bold text-rose-600 md:text-2xl"
            aria-label={`Ausgaben: ${formatCurrency(totalExpenses)}`}
          >
            {formatCurrency(totalExpenses)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
