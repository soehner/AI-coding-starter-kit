"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { MfaAktivierungDialog } from "@/components/mfa-aktivierung-dialog"
import { MfaDeaktivierungDialog } from "@/components/mfa-deaktivierung-dialog"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, KeyRound, ShieldCheck } from "lucide-react"
import type { Factor } from "@supabase/supabase-js"

export default function SicherheitPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [mfaFactor, setMfaFactor] = useState<Factor | null>(null)
  const [isMfaLoading, setIsMfaLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchMfaStatus = useCallback(async () => {
    setIsMfaLoading(true)
    setError(null)

    try {
      const { data, error: mfaError } =
        await supabase.auth.mfa.listFactors()

      if (mfaError) {
        setError(`MFA-Status konnte nicht geladen werden: ${mfaError.message}`)
        setIsMfaLoading(false)
        return
      }

      // Suche nach einem verifizierten TOTP-Faktor
      const verifiedFactor = data.totp.find(
        (f: Factor) => f.status === "verified"
      )
      setMfaFactor(verifiedFactor || null)
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.")
    } finally {
      setIsMfaLoading(false)
    }
  }, [supabase.auth.mfa])

  useEffect(() => {
    if (user) {
      fetchMfaStatus()
    }
  }, [user, fetchMfaStatus])

  function handleMfaAktiviert() {
    fetchMfaStatus()
  }

  function handleMfaDeaktiviert() {
    setMfaFactor(null)
  }

  if (authLoading) {
    return (
      <div className="container max-w-2xl py-8 px-4 md:px-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="container max-w-2xl py-8 px-4 md:px-6">
      <h1 className="text-2xl font-bold mb-6">Sicherheitseinstellungen</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Passwort-Bereich */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            <CardTitle>Passwort</CardTitle>
          </div>
          <CardDescription>
            Ändern Sie Ihr Passwort über das Benutzermenü in der Kopfzeile.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* 2FA-Bereich */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle>Zwei-Faktor-Authentifizierung (2FA)</CardTitle>
          </div>
          <CardDescription>
            Schützen Sie Ihren Account mit einem zusätzlichen Sicherheitsfaktor.
            Nach Aktivierung müssen Sie bei jeder Anmeldung einen Code aus Ihrer
            Authenticator-App eingeben.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isMfaLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-40" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Status:</span>
                {mfaFactor ? (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                    2FA aktiv
                  </Badge>
                ) : (
                  <Badge variant="secondary">2FA inaktiv</Badge>
                )}
              </div>

              {mfaFactor ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Ihre Zwei-Faktor-Authentifizierung ist aktiv. Sie können sie
                    deaktivieren, indem Sie Ihr Passwort bestätigen.
                  </p>
                  <MfaDeaktivierungDialog
                    factorId={mfaFactor.id}
                    onSuccess={handleMfaDeaktiviert}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Aktivieren Sie 2FA, um Ihren Account zusätzlich zu schützen.
                    Sie benötigen eine Authenticator-App wie Google Authenticator,
                    Authy oder Microsoft Authenticator.
                  </p>
                  <MfaAktivierungDialog onSuccess={handleMfaAktiviert} />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
