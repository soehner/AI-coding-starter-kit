"use client"

import { useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Tags } from "lucide-react"
import { useCategories, bulkCategorize } from "@/hooks/use-categories"
import { toast } from "sonner"

type BulkAction = "assign" | "remove"

interface BulkKategorisierungDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedTransactionIds: string[]
  onDone?: () => void
}

export function BulkKategorisierungDialog({
  open,
  onOpenChange,
  selectedTransactionIds,
  onDone,
}: BulkKategorisierungDialogProps) {
  const categories = useCategories()
  const [action, setAction] = useState<BulkAction>("assign")
  const [categoryId, setCategoryId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const count = selectedTransactionIds.length

  async function handleApply() {
    setError(null)
    if (!categoryId) {
      setError("Bitte eine Kategorie auswählen.")
      return
    }
    if (count === 0) {
      setError("Keine Buchungen ausgewählt.")
      return
    }

    const category = categories.find((c) => c.id === categoryId)
    const categoryName = category?.name ?? "Kategorie"

    setIsPending(true)
    try {
      const { changed, total } = await bulkCategorize(
        action,
        selectedTransactionIds,
        categoryId
      )

      if (action === "assign") {
        toast.success(
          `Kategorie „${categoryName}" zu ${changed} Buchung${changed === 1 ? "" : "en"} hinzugefügt` +
            (changed < total ? ` (${total - changed} waren bereits zugeordnet)` : "")
        )
      } else {
        toast.success(
          `Kategorie „${categoryName}" von ${changed} Buchung${changed === 1 ? "" : "en"} entfernt`
        )
      }

      setCategoryId("")
      setAction("assign")
      onOpenChange(false)
      onDone?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler bei der Massenaktion")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Kategorien für {count} Buchung{count === 1 ? "" : "en"}
          </DialogTitle>
          <DialogDescription>
            Weise eine Kategorie zu oder entferne sie von allen markierten Buchungen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Aktion</Label>
            <RadioGroup
              value={action}
              onValueChange={(v) => setAction(v as BulkAction)}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="assign" id="bulk-assign" />
                <Label htmlFor="bulk-assign" className="cursor-pointer font-normal">
                  Kategorie hinzufügen
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="remove" id="bulk-remove" />
                <Label htmlFor="bulk-remove" className="cursor-pointer font-normal">
                  Kategorie entfernen
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-category">Kategorie</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="bulk-category">
                <SelectValue placeholder="Kategorie wählen…" />
              </SelectTrigger>
              <SelectContent>
                {categories.length === 0 ? (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    Noch keine Kategorien angelegt.
                  </div>
                ) : (
                  categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: cat.color }}
                          aria-hidden="true"
                        />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Abbrechen
          </Button>
          <Button onClick={handleApply} disabled={!categoryId || count === 0 || isPending}>
            Anwenden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
