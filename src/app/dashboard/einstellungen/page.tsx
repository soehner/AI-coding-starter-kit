"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { ApiSettingsForm } from "@/components/api-settings-form"
import { SeafileSettingsForm } from "@/components/seafile-settings-form"
import { PasswordChangeDialog } from "@/components/password-change-dialog"
import { MfaAktivierungDialog } from "@/components/mfa-aktivierung-dialog"
import { MfaDeaktivierungDialog } from "@/components/mfa-deaktivierung-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, KeyRound, ShieldCheck } from "lucide-react"
import type { Factor } from "@supabase/supabase-js"

export default function EinstellungenPage() {
  const { user, isLoading: authLoading, isAdmin, updatePassword } = useAuth()
  const [mfaFactor, setMfaFactor] = useState<Factor | null>(null)
  const [isMfaLoading, setIsMfaLoading] = useState(true)
  const [mfaError, setMfaError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchMfaStatus = useCallback(async () => {
    setIsMfaLoading(true)
    setMfaError(null)

    try {
      const { data, error } = await supabase.auth.mfa.listFactors()

      if (error) {
        setMfaError(`MFA-Status konnte nicht geladen werden: ${error.message}`)
        setIsMfaLoading(false)
        return
      }

      const verifiedFactor = data.totp.find(
        (f: Factor) => f.status === "verified"
      )
      setMfaFactor(verifiedFactor || null)
    } catch {
      setMfaError("Ein unerwarteter Fehler ist aufgetreten.")
    } finally {
      setIsMfaLoading(false)
    }
  }, [supabase.auth.mfa])

  useEffect(() => {
    if (user) {
      fetchMfaStatus()
    }
  }, [user, fetchMfaStatus])

  if (authLoading) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const defaultTab = isAdmin ? "integration" : "sicherheit"

  return (
    <div className="container px-4 py-8 md:px-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Einstellungen</h2>
        <p className="text-sm text-muted-foreground">
          Verwalte Integrationen, Sicherheit und dein Passwort.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="max-w-2xl">
        <TabsList>
          {isAdmin && (
            <TabsTrigger value="integration">Integration</TabsTrigger>
          )}
          <TabsTrigger value="sicherheit">Sicherheit</TabsTrigger>
          <TabsTrigger value="passwort">Passwort</TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="integration" className="space-y-8 pt-4">
            <ApiSettingsForm />
            <SeafileSettingsForm />
          </TabsContent>
        )}

        <TabsContent value="sicherheit" className="pt-4">
          {mfaError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{mfaError}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <CardTitle>Zwei-Faktor-Authentifizierung (2FA)</CardTitle>
              </div>
              <CardDescription>
                Schütze deinen Account mit einem zusätzlichen Sicherheitsfaktor.
                Nach Aktivierung musst du bei jeder Anmeldung einen Code aus
                deiner Authenticator-App eingeben.
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
                      <Badge
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        2FA aktiv
                      </Badge>
                    ) : (
                      <Badge variant="secondary">2FA inaktiv</Badge>
                    )}
                  </div>

                  {mfaFactor ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Deine Zwei-Faktor-Authentifizierung ist aktiv. Du kannst
                        sie deaktivieren, indem du dein Passwort bestätigst.
                      </p>
                      <MfaDeaktivierungDialog
                        factorId={mfaFactor.id}
                        onSuccess={() => setMfaFactor(null)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Aktiviere 2FA, um deinen Account zusätzlich zu
                        schützen. Du benötigst eine Authenticator-App wie
                        Google Authenticator, Authy oder Microsoft
                        Authenticator.
                      </p>
                      <MfaAktivierungDialog onSuccess={fetchMfaStatus} />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="passwort" className="pt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                <CardTitle>Passwort ändern</CardTitle>
              </div>
              <CardDescription>
                Vergib ein neues Passwort für dein Konto. Es muss mindestens
                8 Zeichen lang sein.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordChangeDialog onUpdatePassword={updatePassword} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
