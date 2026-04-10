"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react"

const resetSchema = z.object({
  email: z.email("Bitte geben Sie eine gültige E-Mail-Adresse ein."),
})

type ResetFormValues = z.infer<typeof resetSchema>

export function PasswordResetForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const supabase = createClient()

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: "",
    },
  })

  async function onSubmit(values: ResetFormValues) {
    setIsLoading(true)
    setError(null)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        values.email,
        {
          redirectTo: `${window.location.origin}/login`,
        }
      )

      if (resetError) {
        setError(resetError.message)
        setIsLoading(false)
        return
      }

      setIsSuccess(true)
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">E-Mail gesendet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir
              Ihnen einen Link zum Zurücksetzen des Passworts gesendet. Bitte
              prüfen Sie Ihr Postfach.
            </AlertDescription>
          </Alert>
          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Zurück zur Anmeldung
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">
          Passwort zurücksetzen
        </CardTitle>
        <CardDescription>
          Geben Sie Ihre E-Mail-Adresse ein, um einen Reset-Link zu erhalten.
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gesendet...
                </>
              ) : (
                "Reset-Link senden"
              )}
            </Button>
          </form>
        </Form>
        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Zurück zur Anmeldung
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
