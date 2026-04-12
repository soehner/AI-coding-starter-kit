"use client"

import { useState, useEffect } from "react"
import QRCode from "qrcode"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle2, Copy, ShieldCheck } from "lucide-react"

interface MfaAktivierungDialogProps {
  onSuccess: () => void
}

type Schritt = "qr-code" | "code-bestätigen" | "backup-codes"

export function MfaAktivierungDialog({ onSuccess }: MfaAktivierungDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [schritt, setSchritt] = useState<Schritt>("qr-code")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // QR-Code Daten
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [setupKey, setSetupKey] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)

  // TOTP-Code
  const [totpCode, setTotpCode] = useState("")

  // Backup-Codes
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [backupCodesCopied, setBackupCodesCopied] = useState(false)

  const supabase = createClient()

  // Beim Öffnen des Dialogs: MFA-Enrollment starten
  useEffect(() => {
    if (!isOpen) return

    async function enrollMfa() {
      setIsLoading(true)
      setError(null)

      try {
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "CBS-Finanz Authenticator",
        })

        if (enrollError) {
          setError(`MFA-Registrierung fehlgeschlagen: ${enrollError.message}`)
          setIsLoading(false)
          return
        }

        if (data?.totp?.uri && data?.totp?.secret) {
          const dataUrl = await QRCode.toDataURL(data.totp.uri, {
            width: 256,
            margin: 2,
          })
          setQrCodeDataUrl(dataUrl)
          setSetupKey(data.totp.secret)
          setFactorId(data.id)
        }
      } catch {
        setError("Ein unerwarteter Fehler ist aufgetreten.")
      } finally {
        setIsLoading(false)
      }
    }

    enrollMfa()
  }, [isOpen, supabase.auth.mfa])

  async function handleCodeVerifizieren() {
    if (totpCode.length !== 6 || !factorId) return

    setIsLoading(true)
    setError(null)

    try {
      // Challenge erstellen
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId })

      if (challengeError) {
        setError(`Challenge fehlgeschlagen: ${challengeError.message}`)
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
        setError("Ungültiger Code. Bitte versuchen Sie es erneut.")
        setTotpCode("")
        setIsLoading(false)
        return
      }

      // Backup-Codes generieren
      try {
        const response = await fetch("/api/auth/mfa/backup-codes", {
          method: "POST",
        })

        if (response.ok) {
          const data = await response.json()
          setBackupCodes(data.codes)
        } else {
          // 2FA wurde aktiviert, aber Backup-Codes konnten nicht erstellt werden
          console.error("Backup-Codes konnten nicht generiert werden")
        }
      } catch {
        console.error("Fehler beim Generieren der Backup-Codes")
      }

      setSchritt("backup-codes")
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.")
    } finally {
      setIsLoading(false)
    }
  }

  function handleBackupCodesCopy() {
    const text = backupCodes.join("\n")
    navigator.clipboard.writeText(text)
    setBackupCodesCopied(true)
    setTimeout(() => setBackupCodesCopied(false), 3000)
  }

  function handleFertig() {
    setIsOpen(false)
    onSuccess()
  }

  function handleOpenChange(open: boolean) {
    // Nur schliessen wenn wir nicht im Backup-Codes-Schritt sind
    if (!open && schritt === "backup-codes") {
      // Im Backup-Codes-Schritt nur über den Fertig-Button schliessbar
      return
    }

    setIsOpen(open)
    if (!open) {
      resetState()
    }
  }

  function resetState() {
    setSchritt("qr-code")
    setError(null)
    setQrCodeDataUrl(null)
    setSetupKey(null)
    setFactorId(null)
    setTotpCode("")
    setBackupCodes([])
    setBackupCodesCopied(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <ShieldCheck className="mr-2 h-4 w-4" />
          2FA aktivieren
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={(e) => {
          if (schritt === "backup-codes") e.preventDefault()
        }}
      >
        {schritt === "qr-code" && (
          <>
            <DialogHeader>
              <DialogTitle>2FA aktivieren – Schritt 1 von 3</DialogTitle>
              <DialogDescription>
                Scannen Sie den QR-Code mit Ihrer Authenticator-App (z.B. Google
                Authenticator, Authy, Microsoft Authenticator).
              </DialogDescription>
            </DialogHeader>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col items-center gap-4 py-4">
              {isLoading ? (
                <div className="flex h-64 w-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR-Code für Authenticator-App"
                  className="h-64 w-64 rounded-lg border"
                />
              ) : null}

              {setupKey && (
                <div className="w-full space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    Oder geben Sie diesen Schlüssel manuell ein:
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <code className="rounded bg-muted px-3 py-2 text-sm font-mono select-all">
                      {setupKey}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(setupKey)
                      }}
                      aria-label="Setup-Schlüssel kopieren"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={() => {
                setError(null)
                setSchritt("code-bestätigen")
              }}
              disabled={!qrCodeDataUrl}
              className="w-full"
            >
              Weiter
            </Button>
          </>
        )}

        {schritt === "code-bestätigen" && (
          <>
            <DialogHeader>
              <DialogTitle>2FA aktivieren – Schritt 2 von 3</DialogTitle>
              <DialogDescription>
                Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein,
                um die Aktivierung zu bestätigen.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col items-center gap-6 py-4">
              <InputOTP
                maxLength={6}
                value={totpCode}
                onChange={(value) => setTotpCode(value)}
                disabled={isLoading}
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setError(null)
                  setTotpCode("")
                  setSchritt("qr-code")
                }}
                disabled={isLoading}
                className="flex-1"
              >
                Zurück
              </Button>
              <Button
                onClick={handleCodeVerifizieren}
                disabled={totpCode.length !== 6 || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird geprüft...
                  </>
                ) : (
                  "Aktivieren"
                )}
              </Button>
            </div>
          </>
        )}

        {schritt === "backup-codes" && (
          <>
            <DialogHeader>
              <DialogTitle>2FA aktiviert – Backup-Codes</DialogTitle>
              <DialogDescription>
                Speichern Sie diese Einmal-Codes sicher ab. Sie können einen
                Backup-Code verwenden, falls Sie keinen Zugriff auf Ihre
                Authenticator-App haben.
              </DialogDescription>
            </DialogHeader>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Wichtig:</strong> Diese Codes werden nur einmal angezeigt.
                Speichern oder drucken Sie sie jetzt aus!
              </AlertDescription>
            </Alert>

            {backupCodes.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-4">
                {backupCodes.map((code, index) => (
                  <code
                    key={index}
                    className="rounded bg-background px-3 py-1.5 text-center text-sm font-mono"
                  >
                    {code}
                  </code>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Backup-Codes konnten nicht generiert werden. Bitte wenden Sie sich
                an den Administrator.
              </p>
            )}

            <div className="flex gap-2">
              {backupCodes.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleBackupCodesCopy}
                  className="flex-1"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {backupCodesCopied ? "Kopiert!" : "Codes kopieren"}
                </Button>
              )}
              <Button onClick={handleFertig} className="flex-1">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Fertig – Codes gespeichert
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
