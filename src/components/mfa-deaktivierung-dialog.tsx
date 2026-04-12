"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, ShieldOff } from "lucide-react"

const deaktivierungSchema = z.object({
  password: z.string().min(1, "Bitte geben Sie Ihr Passwort ein."),
})

type DeaktivierungFormValues = z.infer<typeof deaktivierungSchema>

interface MfaDeaktivierungDialogProps {
  factorId: string
  onSuccess: () => void
}

export function MfaDeaktivierungDialog({
  factorId,
  onSuccess,
}: MfaDeaktivierungDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const form = useForm<DeaktivierungFormValues>({
    resolver: zodResolver(deaktivierungSchema),
    defaultValues: {
      password: "",
    },
  })

  async function onSubmit(values: DeaktivierungFormValues) {
    setIsLoading(true)
    setError(null)

    try {
      // Passwort serverseitig verifizieren (ohne die aktive Session zu verändern)
      const verifyRes = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: values.password }),
      })

      if (!verifyRes.ok) {
        const data = await verifyRes.json()
        setError(data.error || "Falsches Passwort. Bitte versuchen Sie es erneut.")
        setIsLoading(false)
        return
      }

      // MFA-Faktor deaktivieren
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      })

      if (unenrollError) {
        setError(`2FA konnte nicht deaktiviert werden: ${unenrollError.message}`)
        setIsLoading(false)
        return
      }

      setIsOpen(false)
      onSuccess()
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.")
    } finally {
      setIsLoading(false)
    }
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (!open) {
      form.reset()
      setError(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <ShieldOff className="mr-2 h-4 w-4" />
          2FA deaktivieren
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>2FA deaktivieren</DialogTitle>
          <DialogDescription>
            Geben Sie Ihr Passwort ein, um die Zwei-Faktor-Authentifizierung zu
            deaktivieren. Ihr Account wird danach nur noch durch Ihr Passwort
            geschützt.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aktuelles Passwort</FormLabel>
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
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird deaktiviert...
                  </>
                ) : (
                  "2FA deaktivieren"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
