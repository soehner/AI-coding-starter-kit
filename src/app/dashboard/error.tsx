"use client"

import { useEffect } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, RotateCw } from "lucide-react"

/**
 * Error-Boundary auf Dashboard-Ebene. Fängt Client-Crashes in allen
 * Unterseiten ab und zeigt die konkrete Fehlermeldung + Stack, damit
 * Diagnose ohne Browser-Konsole möglich ist. Der App-Header und die
 * Navigation bleiben durch die Route-Level-Boundary erhalten.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard Error Boundary:", error)
  }, [error])

  return (
    <div className="container px-4 py-8 md:px-6">
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Fehler im Dashboard</AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p>
            In diesem Bereich ist ein unerwarteter Fehler aufgetreten. Der
            Stack-Trace unten hilft bei der Diagnose.
          </p>
          <pre className="max-h-80 overflow-auto rounded-md bg-background/50 p-3 text-xs leading-relaxed">
            <strong>Name:</strong> {error.name}
            {"\n"}
            <strong>Message:</strong> {error.message}
            {error.digest && (
              <>
                {"\n"}
                <strong>Digest:</strong> {error.digest}
              </>
            )}
            {error.stack && (
              <>
                {"\n\n"}
                <strong>Stack:</strong>
                {"\n"}
                {error.stack}
              </>
            )}
          </pre>
        </AlertDescription>
      </Alert>

      <div className="flex gap-2">
        <Button onClick={() => reset()}>
          <RotateCw className="mr-2 h-4 w-4" />
          Erneut versuchen
        </Button>
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/dashboard")}
        >
          Zurück zum Dashboard
        </Button>
      </div>
    </div>
  )
}
