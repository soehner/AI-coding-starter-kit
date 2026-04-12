"use client"

import { useRef, useState } from "react"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  applyCategorizationRules,
  type ApplyRulesProgress,
} from "@/hooks/use-categorization-rules"

interface RegelnAnwendenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Scope = "uncategorized" | "all"

interface Result {
  processed: number
  categorized: number
  assignmentsCreated: number
}

export function RegelnAnwendenDialog({
  open,
  onOpenChange,
}: RegelnAnwendenDialogProps) {
  const [scope, setScope] = useState<Scope>("uncategorized")
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [progress, setProgress] = useState<ApplyRulesProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function handleOpenChange(next: boolean) {
    if (isRunning) return
    if (!next) {
      setError(null)
      setResult(null)
      setProgress(null)
    }
    onOpenChange(next)
  }

  function handleCancel() {
    if (isRunning && abortRef.current) {
      abortRef.current.abort()
    }
  }

  async function handleApply() {
    setError(null)
    setResult(null)
    setProgress(null)
    setIsRunning(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await applyCategorizationRules(scope, {
        onProgress: (p) => setProgress(p),
        signal: controller.signal,
      })
      setResult(res)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Verarbeitung abgebrochen.")
      } else {
        setError(
          err instanceof Error ? err.message : "Fehler beim Anwenden der Regeln"
        )
      }
    } finally {
      setIsRunning(false)
      abortRef.current = null
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Regeln auf Buchungen anwenden</DialogTitle>
          <DialogDescription>
            Wendet alle aktiven Kategorisierungsregeln auf bestehende
            Buchungen an. Mehrere passende Regeln werden gleichzeitig
            zugewiesen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>{result.processed}</strong> Buchung
                {result.processed === 1 ? "" : "en"} geprüft.{" "}
                <strong>{result.categorized}</strong> davon wurde
                {result.categorized === 1 ? "" : "n"} kategorisiert
                {result.assignmentsCreated > 0 && (
                  <>
                    {" "}
                    (<strong>{result.assignmentsCreated}</strong> neue
                    Zuordnung{result.assignmentsCreated === 1 ? "" : "en"})
                  </>
                )}
                .
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Label>Auf welche Buchungen anwenden?</Label>
              <RadioGroup
                value={scope}
                onValueChange={(v) => setScope(v as Scope)}
                disabled={isRunning}
                className="space-y-1"
              >
                <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 hover:bg-accent">
                  <RadioGroupItem
                    value="uncategorized"
                    id="scope-uncategorized"
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="block text-sm font-medium">
                      Nur unkategorisierte Buchungen
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Buchungen mit bestehenden Kategorien bleiben unverändert.
                    </span>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 hover:bg-accent">
                  <RadioGroupItem
                    value="all"
                    id="scope-all"
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="block text-sm font-medium">
                      Alle Buchungen
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Passende Regeln werden auch auf bereits kategorisierte
                      Buchungen angewendet. Bestehende Kategorien bleiben
                      zusätzlich erhalten.
                    </span>
                  </div>
                </label>
              </RadioGroup>
            </div>
          )}

          {isRunning && (
            <div className="space-y-2" aria-live="polite">
              {progress && progress.total > 0 ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {progress.processed} von {progress.total} Buchungen
                      verarbeitet
                    </span>
                    <span className="font-medium tabular-nums">
                      {Math.round((progress.processed / progress.total) * 100)}
                      %
                    </span>
                  </div>
                  <Progress
                    value={(progress.processed / progress.total) * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Chunk {progress.chunkIndex} von {progress.chunkCount}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Buchungen werden ermittelt…
                  </p>
                  <Progress value={undefined} className="h-2" />
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Schließen
            </Button>
          ) : isRunning ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
            >
              Abbrechen
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button type="button" onClick={handleApply}>
                Regeln anwenden
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
