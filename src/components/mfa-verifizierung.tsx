"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, ShieldCheck, ArrowLeft } from "lucide-react"

interface MfaVerifizierungProps {
  factorId: string
  onSuccess: () => void
  onAbbrechen: () => void
}

export function MfaVerifizierung({
  factorId,
  onSuccess,
  onAbbrechen,
}: MfaVerifizierungProps) {
  const [totpCode, setTotpCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showBackupInput, setShowBackupInput] = useState(false)
  const [backupCode, setBackupCode] = useState("")
  const [gesperrtBis, setGesperrtBis] = useState<Date | null>(null)
  const [backupCodeHinweis, setBackupCodeHinweis] = useState<string | null>(null)

  const supabase = createClient()

  const istGesperrt = gesperrtBis && new Date() < gesperrtBis

  async function handleTotpVerifizieren() {
    if (totpCode.length !== 6) return
    if (istGesperrt) return

    setIsLoading(true)
    setError(null)

    try {
      // Rate Limiting prüfen
      const rateLimitRes = await fetch("/api/auth/mfa/rate-limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check" }),
      })

      if (rateLimitRes.status === 429) {
        const data = await rateLimitRes.json()
        setGesperrtBis(new Date(data.gesperrtBis))
        setError(
          "Zu viele fehlgeschlagene Versuche. Bitte warten Sie 15 Minuten."
        )
        setIsLoading(false)
        return
      }

      // Challenge erstellen
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId })

      if (challengeError) {
        setError(`Fehler: ${challengeError.message}`)
        setIsLoading(false)
        return
      }

      // Code verifizieren
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: totpCode,
      })

      if (verifyError) {
        // Fehlversuch serverseitig zählen
        const failRes = await fetch("/api/auth/mfa/rate-limit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "fail" }),
        })
        const failData = await failRes.json()

        if (failData.gesperrt) {
          setGesperrtBis(new Date(failData.gesperrtBis))
          setError(
            "Zu viele fehlgeschlagene Versuche. Bitte warten Sie 15 Minuten."
          )
        } else {
          setError(
            `Ungültiger Code. Noch ${failData.verbleibendeVersuche ?? 0} Versuche übrig.`
          )
        }
        setTotpCode("")
        setIsLoading(false)
        return
      }

      // Erfolg melden
      await fetch("/api/auth/mfa/rate-limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      })

      onSuccess()
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleBackupCodeVerifizieren() {
    if (!backupCode.trim()) return
    if (istGesperrt) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/mfa/backup-codes/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: backupCode.trim() }),
      })

      const data = await response.json()

      if (response.status === 429) {
        setGesperrtBis(new Date(data.gesperrtBis))
        setError(
          "Zu viele fehlgeschlagene Versuche. Bitte warten Sie 15 Minuten."
        )
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        if (data.gesperrt) {
          setGesperrtBis(new Date(data.gesperrtBis))
          setError(
            "Zu viele fehlgeschlagene Versuche. Bitte warten Sie 15 Minuten."
          )
        } else {
          setError(data.error || "Ungültiger Backup-Code.")
        }
        setIsLoading(false)
        return
      }

      // Backup-Code war gültig – Server hat MFA-Cookie gesetzt
      // Hinweis über verbleibende Codes anzeigen, falls wenige übrig
      if (data.hinweis) {
        setBackupCodeHinweis(data.hinweis)
      }

      onSuccess()
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">
          Zwei-Faktor-Authentifizierung
        </CardTitle>
        <CardDescription>
          {showBackupInput
            ? "Geben Sie einen Ihrer Backup-Codes ein."
            : "Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {backupCodeHinweis && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{backupCodeHinweis}</AlertDescription>
          </Alert>
        )}

        {!showBackupInput ? (
          <>
            <div className="flex flex-col items-center gap-4">
              <InputOTP
                maxLength={6}
                value={totpCode}
                onChange={(value) => setTotpCode(value)}
                disabled={isLoading || !!istGesperrt}
                autoFocus
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={handleTotpVerifizieren}
              disabled={totpCode.length !== 6 || isLoading || !!istGesperrt}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird geprüft...
                </>
              ) : (
                "Code bestätigen"
              )}
            </Button>

            <div className="text-center">
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setShowBackupInput(true)
                  setError(null)
                }}
                className="text-muted-foreground"
              >
                Backup-Code verwenden
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="backup-code">Backup-Code</Label>
              <Input
                id="backup-code"
                type="text"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                placeholder="Backup-Code eingeben"
                disabled={isLoading || !!istGesperrt}
                autoFocus
                autoComplete="off"
              />
            </div>

            <Button
              onClick={handleBackupCodeVerifizieren}
              disabled={!backupCode.trim() || isLoading || !!istGesperrt}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird geprüft...
                </>
              ) : (
                "Backup-Code verwenden"
              )}
            </Button>

            <div className="text-center">
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setShowBackupInput(false)
                  setBackupCode("")
                  setError(null)
                }}
                className="text-muted-foreground"
              >
                <ArrowLeft className="mr-1 h-3 w-3" />
                Zurück zur Code-Eingabe
              </Button>
            </div>
          </>
        )}

        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAbbrechen}
            className="text-muted-foreground"
          >
            Zurück zum Login
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
