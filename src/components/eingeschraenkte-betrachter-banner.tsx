"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CategoryBadge } from "@/components/category-badge"
import { Info } from "lucide-react"
import type { Category } from "@/lib/types"

/**
 * PROJ-14: Hinweisbanner für eingeschränkte Betrachter im Dashboard.
 * Wird nur eingeblendet, wenn der eingeloggte Benutzer eine aktive
 * Kategorie-Einschränkung hat. Die Liste der erlaubten Kategorien wird
 * als Badges angezeigt – so sieht der Betrachter sofort, welchen
 * Ausschnitt er aktuell einsehen kann.
 */

interface EingeschraenkteBetrachterBannerProps {
  allowedCategories: Category[]
}

export function EingeschraenkteBetrachterBanner({
  allowedCategories,
}: EingeschraenkteBetrachterBannerProps) {
  const hasAny = allowedCategories.length > 0

  return (
    <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-100">
      <Info className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Gefilterte Ansicht</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Ihre Ansicht ist auf bestimmte Kategorien beschränkt. Unkategorisierte
          Buchungen und Buchungen anderer Kategorien werden nicht angezeigt.
        </p>
        {hasAny ? (
          <div className="flex flex-wrap gap-1.5">
            {allowedCategories.map((cat) => (
              <CategoryBadge key={cat.id} category={cat} />
            ))}
          </div>
        ) : (
          <p className="text-xs italic">
            Aktuell sind keine Kategorien freigegeben. Bitte wenden Sie sich an
            den Kassenwart, wenn Sie Daten einsehen müssen.
          </p>
        )}
      </AlertDescription>
    </Alert>
  )
}
