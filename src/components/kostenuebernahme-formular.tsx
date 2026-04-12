"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

const kostenuebernahmeSchema = z.object({
  firstName: z
    .string()
    .min(1, "Bitte geben Sie Ihren Vornamen ein.")
    .max(100, "Der Vorname darf maximal 100 Zeichen lang sein."),
  lastName: z
    .string()
    .min(1, "Bitte geben Sie Ihren Nachnamen ein.")
    .max(100, "Der Nachname darf maximal 100 Zeichen lang sein."),
  email: z.email("Bitte geben Sie eine gültige E-Mail-Adresse ein."),
  amount: z
    .string()
    .min(1, "Bitte geben Sie einen Betrag ein.")
    .refine(
      (val) => {
        const num = parseFloat(val.replace(",", "."))
        return !isNaN(num) && num > 0
      },
      { message: "Bitte geben Sie einen Betrag größer als 0 Euro ein." }
    ),
  purpose: z
    .string()
    .min(1, "Bitte geben Sie einen Verwendungszweck ein.")
    .max(2000, "Der Verwendungszweck darf maximal 2000 Zeichen lang sein."),
})

type KostenuebernahmeFormValues = z.infer<typeof kostenuebernahmeSchema>

export function KostenuebernahmeFormular() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const form = useForm<KostenuebernahmeFormValues>({
    resolver: zodResolver(kostenuebernahmeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      amount: "",
      purpose: "",
    },
  })

  async function onSubmit(values: KostenuebernahmeFormValues) {
    setIsLoading(true)
    setError(null)

    try {
      const amount = parseFloat(values.amount.replace(",", "."))

      const response = await fetch("/api/cost-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim().toLowerCase(),
          amount,
          purpose: values.purpose.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          setError(
            "Sie haben zu viele Anträge in kurzer Zeit gestellt. Bitte versuchen Sie es später erneut."
          )
        } else {
          setError(
            data.error ||
              "Der Antrag konnte nicht eingereicht werden. Bitte versuchen Sie es erneut."
          )
        }
        return
      }

      setIsSubmitted(true)
    } catch {
      setError(
        "Ein Netzwerkfehler ist aufgetreten. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut."
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Erfolgsmeldung nach dem Absenden
  if (isSubmitted) {
    return (
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2
                className="h-6 w-6 text-green-600"
                aria-hidden="true"
              />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">
                Antrag erfolgreich eingereicht
              </h2>
              <p className="text-sm text-muted-foreground">
                Ihr Antrag auf Kostenübernahme wurde erfolgreich eingereicht.
                Die zuständigen Personen werden per E-Mail benachrichtigt und
                über Ihren Antrag abstimmen.
              </p>
              <p className="text-sm text-muted-foreground">
                Sie erhalten eine E-Mail, sobald eine Entscheidung gefallen ist.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setIsSubmitted(false)
                form.reset()
              }}
              className="mt-2"
            >
              Neuen Antrag stellen
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-xl font-bold sm:text-2xl">
          Kostenübernahme-Antrag
        </CardTitle>
        <CardDescription>
          CBS-Mannheim Förderverein e.V. - Stellen Sie hier Ihren Antrag auf
          Kostenübernahme.
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
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vorname</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Max"
                        autoComplete="given-name"
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
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nachname</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Mustermann"
                        autoComplete="family-name"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail-Adresse</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="max.mustermann@example.com"
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Betrag (in Euro)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        disabled={isLoading}
                        className="pr-8"
                        {...field}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        EUR
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verwendungszweck</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Beschreiben Sie bitte den Zweck der Kostenübernahme..."
                      rows={4}
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
                  Antrag wird eingereicht...
                </>
              ) : (
                "Antrag einreichen"
              )}
            </Button>
          </form>
        </Form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Mit dem Absenden des Antrags stimmen Sie zu, dass Ihre Daten zur
          Bearbeitung des Antrags gespeichert und an die zuständigen
          Vereinsverantwortlichen weitergeleitet werden.
        </p>
      </CardContent>
    </Card>
  )
}
