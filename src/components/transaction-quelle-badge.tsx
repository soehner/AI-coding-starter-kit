"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  HelpCircle,
  Wifi,
} from "lucide-react"
import type { Transaction } from "@/lib/types"

interface TransactionQuelleBadgeProps {
  transaction: Pick<Transaction, "quelle" | "status">
  onClick?: () => void
  className?: string
}

type BadgeConfig = {
  label: string
  shortLabel: string
  icon: React.ReactNode
  className: string
  aria: string
}

function getBadgeConfig(
  status: Transaction["status"],
  quelle: Transaction["quelle"]
): BadgeConfig {
  // Status hat Vorrang vor Quelle
  switch (status) {
    case "bestaetigt":
      return {
        label: "Bestätigt",
        shortLabel: "Bestätigt",
        icon: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
        className:
          "border-green-600 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300",
        aria: "Quelle: PDF und PSD2 abgeglichen und bestätigt",
      }
    case "vorschlag":
      return {
        label: "Vorschlag",
        shortLabel: "Vorschlag",
        icon: <HelpCircle className="h-3 w-3" aria-hidden="true" />,
        className:
          "border-orange-500 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-300",
        aria: "Abgleich-Vorschlag — manuelle Bestätigung nötig",
      }
    case "konflikt":
      return {
        label: "Konflikt",
        shortLabel: "Konflikt",
        icon: <AlertTriangle className="h-3 w-3" aria-hidden="true" />,
        className:
          "border-red-600 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300",
        aria: "Abweichung zwischen PDF und PSD2",
      }
    case "nur_psd2":
      return {
        label: "PSD2",
        shortLabel: "PSD2",
        icon: <Wifi className="h-3 w-3" aria-hidden="true" />,
        className:
          "border-yellow-500 bg-yellow-50 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-950 dark:text-yellow-300",
        aria: "Quelle: nur Direktabruf der Bank (noch kein PDF-Auszug)",
      }
    case "nur_pdf":
    default:
      // Fallback: Quelle 'pdf' und kein Status
      if (quelle === "beide") {
        return {
          label: "Bestätigt",
          shortLabel: "Bestätigt",
          icon: <CheckCircle2 className="h-3 w-3" aria-hidden="true" />,
          className:
            "border-green-600 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300",
          aria: "Quelle: PDF und PSD2",
        }
      }
      return {
        label: "PDF",
        shortLabel: "PDF",
        icon: <FileText className="h-3 w-3" aria-hidden="true" />,
        className:
          "border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300",
        aria: "Quelle: PDF-Kontoauszug",
      }
  }
}

export function TransactionQuelleBadge({
  transaction,
  onClick,
  className,
}: TransactionQuelleBadgeProps) {
  const status = transaction.status ?? "nur_pdf"
  const quelle = transaction.quelle ?? "pdf"
  const config = getBadgeConfig(status, quelle)
  const isClickable = !!onClick && (status === "vorschlag" || status === "konflikt")

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 whitespace-nowrap",
        config.className,
        isClickable && "cursor-pointer",
        className
      )}
      aria-label={config.aria}
    >
      {config.icon}
      <span className="text-xs">{config.shortLabel}</span>
    </Badge>
  )

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex"
        aria-label={`${config.aria} — Details öffnen`}
      >
        {badge}
      </button>
    )
  }

  return badge
}
