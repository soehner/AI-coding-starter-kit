"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
  TestTube2,
  HardDrive,
} from "lucide-react"

interface SeafileSettingsState {
  url: string
  token: string
  repoId: string
  receiptPath: string
  statementPath: string
  hasExistingToken: boolean
  hasExistingUrl: boolean
}

export function SeafileSettingsForm() {
  const [settings, setSettings] = useState<SeafileSettingsState>({
    url: "",
    token: "",
    repoId: "",
    receiptPath: "/Förderverein/Belege/",
    statementPath: "/Förderverein/Kontoauszüge/",
    hasExistingToken: false,
    hasExistingUrl: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const fetchSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/settings")
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Einstellungen konnten nicht geladen werden.")
        return
      }

      setSettings({
        url: data.seafile_url || "",
        token: "",
        repoId: data.seafile_repo_id || "",
        receiptPath: data.seafile_receipt_path || "/Förderverein/Belege/",
        statementPath: data.seafile_statement_path || "/Förderverein/Kontoauszüge/",
        hasExistingToken: data.hasSeafileToken || false,
        hasExistingUrl: !!data.seafile_url,
      })
    } catch {
      setError("Netzwerkfehler beim Laden der Einstellungen.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    setTestResult(null)

    try {
      const body: Record<string, string> = {
        seafile_url: settings.url.trim(),
        seafile_repo_id: settings.repoId.trim(),
        seafile_receipt_path: settings.receiptPath.trim(),
        seafile_statement_path: settings.statementPath.trim(),
      }

      // Token nur senden, wenn ein neuer eingegeben wurde
      if (settings.token.trim()) {
        body.seafile_token = settings.token.trim()
      }

      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Einstellungen konnten nicht gespeichert werden.")
        return
      }

      setSuccess("Seafile-Einstellungen erfolgreich gespeichert.")
      setSettings((prev) => ({
        ...prev,
        token: "",
        hasExistingToken: prev.token.trim() ? true : prev.hasExistingToken,
        hasExistingUrl: !!prev.url.trim(),
      }))
    } catch {
      setError("Netzwerkfehler beim Speichern der Einstellungen.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTestConnection() {
    setIsTesting(true)
    setTestResult(null)
    setError(null)

    try {
      const response = await fetch("/api/admin/seafile/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: settings.url.trim(),
          repo_id: settings.repoId.trim(),
          // Wenn ein neuer Token eingegeben wurde, diesen testen; sonst den gespeicherten
          ...(settings.token.trim() ? { token: settings.token.trim() } : {}),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setTestResult({
          success: false,
          message: data.error || "Verbindungstest fehlgeschlagen.",
        })
        return
      }

      setTestResult({
        success: true,
        message: "Verbindung zu Seafile erfolgreich hergestellt.",
      })
    } catch {
      setTestResult({
        success: false,
        message: "Netzwerkfehler beim Testen der Verbindung.",
      })
    } finally {
      setIsTesting(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    )
  }

  const canTest =
    settings.url.trim() !== "" &&
    settings.repoId.trim() !== "" &&
    (settings.token.trim() !== "" || settings.hasExistingToken)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Seafile-Konfiguration
          {settings.hasExistingToken && settings.hasExistingUrl && (
            <Badge variant="secondary" className="text-xs">
              Konfiguriert
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Verbinde die App mit deinem Seafile-Server, um Belege und Kontoauszüge
          zentral abzulegen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Server-Verbindung */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Server-Verbindung</h4>

          <div className="space-y-2">
            <Label htmlFor="seafile-url">Seafile Server-URL</Label>
            <Input
              id="seafile-url"
              type="url"
              placeholder="https://seafile.example.com"
              value={settings.url}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, url: e.target.value }))
              }
              aria-label="Seafile Server-URL"
            />
            <p className="text-xs text-muted-foreground">
              Die vollständige URL deines Seafile-Servers (ohne abschließenden Schrägstrich).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seafile-token">API-Token</Label>
            <Input
              id="seafile-token"
              type="password"
              placeholder={
                settings.hasExistingToken
                  ? "Token gespeichert - leer lassen um beizubehalten"
                  : "Seafile API-Token eingeben"
              }
              value={settings.token}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, token: e.target.value }))
              }
              aria-label="Seafile API-Token"
            />
            <p className="text-xs text-muted-foreground">
              API-Token aus Seafile → Einstellungen → Web API Tokens.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seafile-repo-id">Bibliotheks-ID</Label>
            <Input
              id="seafile-repo-id"
              type="text"
              placeholder="z.B. a3b7c9d1-e2f4-4a5b-8c6d-7e8f9a0b1c2d"
              value={settings.repoId}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, repoId: e.target.value }))
              }
              aria-label="Seafile Bibliotheks-ID"
            />
            <p className="text-xs text-muted-foreground">
              Die UUID der Seafile-Bibliothek, in der Dateien abgelegt werden sollen.
            </p>
          </div>
        </div>

        <Separator />

        {/* Pfad-Konfiguration */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Verzeichnisse</h4>

          <div className="space-y-2">
            <Label htmlFor="seafile-receipt-path">Basispfad für Belege</Label>
            <Input
              id="seafile-receipt-path"
              type="text"
              placeholder="/Förderverein/Belege/"
              value={settings.receiptPath}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, receiptPath: e.target.value }))
              }
              aria-label="Basispfad für Belege"
            />
            <p className="text-xs text-muted-foreground">
              Belege werden in Unterordnern nach Jahr abgelegt (z.B.
              /Förderverein/Belege/2026/).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seafile-statement-path">
              Basispfad für Kontoauszüge
            </Label>
            <Input
              id="seafile-statement-path"
              type="text"
              placeholder="/Förderverein/Kontoauszüge/"
              value={settings.statementPath}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  statementPath: e.target.value,
                }))
              }
              aria-label="Basispfad für Kontoauszüge"
            />
            <p className="text-xs text-muted-foreground">
              Kontoauszüge werden in Unterordnern nach Jahr abgelegt (z.B.
              /Förderverein/Kontoauszüge/2026/).
            </p>
          </div>
        </div>

        {/* Verbindungstest-Ergebnis */}
        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{testResult.message}</AlertDescription>
          </Alert>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTesting || !canTest}
            aria-label="Seafile-Verbindung testen"
          >
            {isTesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <TestTube2 className="mr-2 h-4 w-4" />
            )}
            Verbindung testen
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            aria-label="Seafile-Einstellungen speichern"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
