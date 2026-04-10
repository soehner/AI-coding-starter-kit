"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { AlertCircle, CheckCircle2, Loader2, Save, TestTube2 } from "lucide-react"
import type { KiProvider } from "@/lib/types"

interface SettingsState {
  provider: KiProvider
  token: string
  hasExistingToken: boolean
}

export function ApiSettingsForm() {
  const [settings, setSettings] = useState<SettingsState>({
    provider: "openai",
    token: "",
    hasExistingToken: false,
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
        provider: data.provider || "openai",
        token: "",
        hasExistingToken: data.hasToken || false,
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
        provider: settings.provider,
      }

      // Token nur senden, wenn ein neuer eingegeben wurde
      if (settings.token.trim()) {
        body.token = settings.token.trim()
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

      setSuccess("Einstellungen erfolgreich gespeichert.")
      setSettings((prev) => ({
        ...prev,
        token: "",
        hasExistingToken: prev.token.trim() ? true : prev.hasExistingToken,
      }))
    } catch {
      setError("Netzwerkfehler beim Speichern der Einstellungen.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTestToken() {
    setIsTesting(true)
    setTestResult(null)
    setError(null)

    try {
      const response = await fetch("/api/admin/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          // Wenn ein neuer Token eingegeben wurde, diesen testen; sonst den gespeicherten
          ...(settings.token.trim() ? { token: settings.token.trim() } : {}),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setTestResult({
          success: false,
          message: data.error || "Token-Test fehlgeschlagen.",
        })
        return
      }

      setTestResult({
        success: true,
        message: "Token ist gueltig und funktioniert.",
      })
    } catch {
      setTestResult({
        success: false,
        message: "Netzwerkfehler beim Testen des Tokens.",
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
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          KI-Konfiguration
          {settings.hasExistingToken && (
            <Badge variant="secondary" className="text-xs">
              Token konfiguriert
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Wähle den KI-Provider und hinterlege den API-Token für das PDF-Parsing.
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

        <div className="space-y-2">
          <Label htmlFor="ki-provider">KI-Provider</Label>
          <Select
            value={settings.provider}
            onValueChange={(value: KiProvider) =>
              setSettings((prev) => ({ ...prev, provider: value }))
            }
          >
            <SelectTrigger id="ki-provider" aria-label="KI-Provider auswählen">
              <SelectValue placeholder="Provider auswählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI (GPT-4 Vision)</SelectItem>
              <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="api-token">API-Token</Label>
          <Input
            id="api-token"
            type="password"
            placeholder={
              settings.hasExistingToken
                ? "Token gespeichert - leer lassen um beizubehalten"
                : "API-Token eingeben"
            }
            value={settings.token}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, token: e.target.value }))
            }
            aria-label="API-Token"
          />
          <p className="text-xs text-muted-foreground">
            {settings.provider === "openai"
              ? "OpenAI API-Key beginnt mit 'sk-...'"
              : "Anthropic API-Key beginnt mit 'sk-ant-...'"}
          </p>
        </div>

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

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleTestToken}
            disabled={isTesting || (!settings.token.trim() && !settings.hasExistingToken)}
            aria-label="Token testen"
          >
            {isTesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <TestTube2 className="mr-2 h-4 w-4" />
            )}
            Token testen
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            aria-label="Einstellungen speichern"
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
