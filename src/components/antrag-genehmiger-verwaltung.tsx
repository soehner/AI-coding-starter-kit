"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Users } from "lucide-react"
import { toast } from "sonner"

interface UserRow {
  id: string
  email: string
  role: "admin" | "viewer"
}

export function AntragGenehmigerVerwaltung() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [initialIds, setInitialIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [usersResp, pooledResp] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/antrag-genehmiger"),
      ])

      if (!usersResp.ok) {
        setError("Benutzerliste konnte nicht geladen werden.")
        return
      }
      if (!pooledResp.ok) {
        setError("Genehmiger-Pool konnte nicht geladen werden.")
        return
      }

      const usersData: UserRow[] = await usersResp.json()
      const pooled: Array<{ user_id: string }> = await pooledResp.json()

      setUsers(usersData)
      const ids = new Set(pooled.map((p) => p.user_id))
      setSelectedIds(ids)
      setInitialIds(new Set(ids))
    } catch {
      setError("Netzwerkfehler beim Laden der Daten.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function toggleUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hasChanges =
    selectedIds.size !== initialIds.size ||
    Array.from(selectedIds).some((id) => !initialIds.has(id))

  async function save() {
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/antrag-genehmiger", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: Array.from(selectedIds) }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Genehmiger konnten nicht gespeichert werden.")
        return
      }
      setInitialIds(new Set(selectedIds))
      toast.success(`${selectedIds.size} Genehmiger gespeichert.`)
    } catch {
      setError("Netzwerkfehler beim Speichern.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <CardTitle>Antrag-Genehmiger</CardTitle>
        </div>
        <CardDescription>
          Wähle die Benutzer aus, die bei neuen Kostenübernahme-Anträgen per
          E-Mail informiert werden und darüber abstimmen. Die Entscheidung
          fällt per Mehrheit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Benutzer vorhanden. Lade zuerst Benutzer über die
            Benutzerverwaltung ein.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {selectedIds.size} von {users.length} Benutzern ausgewählt
              </span>
              {selectedIds.size > 0 && selectedIds.size < 3 && (
                <Badge variant="outline" className="text-amber-600">
                  Hinweis: Mehrheit bei weniger als 3 Genehmigern ist
                  eingeschränkt.
                </Badge>
              )}
            </div>

            <ul className="divide-y rounded-md border">
              {users.map((user) => {
                const checked = selectedIds.has(user.id)
                return (
                  <li key={user.id} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox
                      id={`genehmiger-${user.id}`}
                      checked={checked}
                      onCheckedChange={() => toggleUser(user.id)}
                      aria-label={`${user.email} als Genehmiger auswählen`}
                    />
                    <label
                      htmlFor={`genehmiger-${user.id}`}
                      className="flex flex-1 items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate">{user.email}</span>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role === "admin" ? "Admin" : "Betrachter"}
                      </Badge>
                    </label>
                  </li>
                )
              })}
            </ul>

            <div className="flex items-center justify-end gap-2">
              {!hasChanges && !isSaving && selectedIds.size > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Gespeichert
                </span>
              )}
              <Button onClick={save} disabled={!hasChanges || isSaving}>
                {isSaving ? "Speichern..." : "Speichern"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
