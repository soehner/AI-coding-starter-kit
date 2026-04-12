"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { MfaVerifizierung } from "@/components/mfa-verifizierung"
import { Loader2 } from "lucide-react"

export default function MfaVerifizierungPage() {
  const [factorId, setFactorId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function prüfeMfaStatus() {
      const { data: mfaData } = await supabase.auth.mfa.listFactors()
      const verifiedFactor = mfaData?.totp?.find(
        (f: { status: string }) => f.status === "verified"
      )

      if (verifiedFactor) {
        setFactorId(verifiedFactor.id)
      } else {
        // Kein MFA-Faktor → direkt zum Dashboard
        window.location.assign("/dashboard")
      }
      setIsLoading(false)
    }

    prüfeMfaStatus()
  }, [supabase])

  function handleSuccess() {
    window.location.assign("/dashboard")
  }

  function handleAbbrechen() {
    supabase.auth.signOut()
    window.location.assign("/login")
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!factorId) {
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <MfaVerifizierung
        factorId={factorId}
        onSuccess={handleSuccess}
        onAbbrechen={handleAbbrechen}
      />
    </div>
  )
}
