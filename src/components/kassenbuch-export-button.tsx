"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface KassenbuchExportButtonProps {
  year: string
  month: string
  search: string
}

export function KassenbuchExportButton({
  year,
  month,
  search,
}: KassenbuchExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)

    try {
      const params = new URLSearchParams()
      if (year !== "all") params.set("year", year)
      if (month !== "all") params.set("month", month)
      if (search) params.set("search", search)

      const res = await fetch(`/api/export/kassenbuch?${params}`)

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(
          data?.error || "Fehler beim Exportieren. Bitte erneut versuchen."
        )
      }

      // Dateiname aus Content-Disposition Header extrahieren
      const disposition = res.headers.get("Content-Disposition")
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch?.[1] || "Kassenbuch.xlsx"

      // Blob erstellen und Download auslösen
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success("Export erfolgreich heruntergeladen")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unbekannter Fehler beim Export"
      toast.error(message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={isExporting}
      aria-label="Kassenbuch als Excel exportieren"
      className="w-full md:w-auto"
    >
      {isExporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Excel exportieren
    </Button>
  )
}
