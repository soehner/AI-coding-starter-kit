"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { Loader2, AlertCircle, CheckCircle2, KeyRound } from "lucide-react"

const passwordSchema = z
  .object({
    password: z.string().min(8, "Mindestens 8 Zeichen erforderlich."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwörter stimmen nicht überein.",
    path: ["confirmPassword"],
  })

type PasswordFormValues = z.infer<typeof passwordSchema>

interface PasswordChangeDialogProps {
  onUpdatePassword: (newPassword: string) => Promise<void>
}

export function PasswordChangeDialog({
  onUpdatePassword,
}: PasswordChangeDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  async function onSubmit(values: PasswordFormValues) {
    setIsLoading(true)
    setError(null)

    try {
      await onUpdatePassword(values.password)
      setIsSuccess(true)
      form.reset()
      setTimeout(() => {
        setIsOpen(false)
        setIsSuccess(false)
      }, 2000)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Passwort konnte nicht geändert werden."
      )
    } finally {
      setIsLoading(false)
    }
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (!open) {
      form.reset()
      setError(null)
      setIsSuccess(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start px-2 py-1.5 text-sm font-normal">
          <KeyRound className="mr-2 h-4 w-4" />
          Passwort ändern
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Passwort ändern</DialogTitle>
          <DialogDescription>
            Geben Sie Ihr neues Passwort ein.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Passwort wurde erfolgreich geändert.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Neues Passwort</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Mindestens 8 Zeichen"
                          autoComplete="new-password"
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
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passwort bestätigen</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Passwort wiederholen"
                          autoComplete="new-password"
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
                      Wird geändert...
                    </>
                  ) : (
                    "Passwort ändern"
                  )}
                </Button>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
