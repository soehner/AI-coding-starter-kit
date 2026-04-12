"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/lib/supabase"
import { MfaVerifizierung } from "@/components/mfa-verifizierung"
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle } from "lucide-react"

const loginSchema = z.object({
  email: z.email("Bitte geben Sie eine gültige E-Mail-Adresse ein."),
  password: z.string().min(1, "Bitte geben Sie Ihr Passwort ein."),
})

type LoginFormValues = z.infer<typeof loginSchema>

interface LoginFormProps {
  callbackError?: boolean
}

export function LoginForm({ callbackError }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    callbackError
      ? "Der Verifizierungslink ist abgelaufen oder ungültig. Bitte fordern Sie einen neuen an."
      : null
  )
  // 2FA-Zustand
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [showMfaStep, setShowMfaStep] = useState(false)

  const supabase = createClient()

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: values.email,
          password: values.password,
        }
      )

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("E-Mail oder Passwort ist falsch.")
        } else if (authError.message.includes("Email not confirmed")) {
          setError(
            "Ihre E-Mail-Adresse wurde noch nicht verifiziert. Bitte prüfen Sie Ihr Postfach."
          )
        } else {
          setError(authError.message)
        }
        setIsLoading(false)
        return
      }

      if (data.session) {
        // Prüfen, ob der Benutzer 2FA aktiviert hat
        const { data: mfaData } = await supabase.auth.mfa.listFactors()
        const verifiedFactor = mfaData?.totp?.find(
          (f: { status: string }) => f.status === "verified"
        )

        if (verifiedFactor) {
          // 2FA ist aktiv – Schritt 2 anzeigen
          setMfaFactorId(verifiedFactor.id)
          setShowMfaStep(true)
          setIsLoading(false)
          return
        }

        // Kein 2FA – direkt zum Dashboard
        window.location.assign("/dashboard")
      } else {
        setError("Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.")
        setIsLoading(false)
      }
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.")
      setIsLoading(false)
    }
  }

  function handleMfaSuccess() {
    window.location.assign("/dashboard")
  }

  function handleMfaAbbrechen() {
    // Session beenden und zurück zum Login
    supabase.auth.signOut()
    setShowMfaStep(false)
    setMfaFactorId(null)
    setError(null)
    form.reset()
  }

  // 2FA-Schritt anzeigen
  if (showMfaStep && mfaFactorId) {
    return (
      <MfaVerifizierung
        factorId={mfaFactorId}
        onSuccess={handleMfaSuccess}
        onAbbrechen={handleMfaAbbrechen}
      />
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">CBS-Finanz</CardTitle>
        <CardDescription>
          Melden Sie sich mit Ihren Zugangsdaten an.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      autoComplete="email"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passwort</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Ihr Passwort"
                      autoComplete="current-password"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Anmelden...
                </>
              ) : (
                "Anmelden"
              )}
            </Button>
          </form>
        </Form>
        <div className="mt-4 text-center">
          <Link
            href="/passwort-vergessen"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Passwort vergessen?
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
