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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Kennzahlen werden geladen">
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Finanz-Kennzahlen">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Aktueller Kontostand
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <p
            className={`text-2xl font-bold ${
              currentBalance >= 0 ? "text-foreground" : "text-destructive"
            }`}
            aria-label={`Aktueller Kontostand: ${formatCurrency(currentBalance)}`}
          >
            {formatCurrency(currentBalance)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Einnahmen (Zeitraum)
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <p
            className="text-2xl font-bold text-green-600"
            aria-label={`Einnahmen: ${formatCurrency(totalIncome)}`}
          >
            {formatCurrency(totalIncome)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Ausgaben (Zeitraum)
          </CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <p
            className="text-2xl font-bold text-red-600"
            aria-label={`Ausgaben: ${formatCurrency(totalExpenses)}`}
          >
            {formatCurrency(totalExpenses)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
