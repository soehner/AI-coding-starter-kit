"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { AntragEntscheidung } from "@/components/antrag-entscheidung"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react"

interface AntragInfo {
  antrag_id: string
  applicant_name: string
  applicant_email: string
  amount_cents: number
  purpose: string
  created_at: string
  documents: Array<{ id: string; url: string; name: string }>
}

interface FinalizedInfo {
  finalStatus: "genehmigt" | "abgelehnt"
  decisions: Array<{ decision: "genehmigt" | "abgelehnt"; comment: string | null }>
}

type PageState =
  | "loading"
  | "ready"
  | "expired"
  | "already_decided"
  | "already_finalized"
  | "error"

export default function AntragEntscheidungTokenPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params.token as string
  const aktion = searchParams.get("aktion")
  const preselectedDecision: "genehmigt" | "abgelehnt" | null =
    aktion === "genehmigen"
      ? "genehmigt"
      : aktion === "ablehnen"
        ? "abgelehnt"
        : null

  const [state, setState] = useState<PageState>("loading")
  const [antragInfo, setAntragInfo] = useState<AntragInfo | null>(null)
  const [finalizedInfo, setFinalizedInfo] = useState<FinalizedInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function validateToken() {
      try {
        const response = await fetch(`/api/antraege/decide/${token}`)
        const data = await response.json()

        if (!response.ok) {
          if (response.status === 401) {
            setState("expired")
            return
          }
          if (response.status === 410) {
            if (data.alreadyFinalized) {
              setFinalizedInfo({
                finalStatus: data.finalStatus,
                decisions: data.decisions || [],
              })
              setState("already_finalized")
              return
            }
            setState("already_decided")
            return
          }
          setState("error")
          setError(data.error || "Token konnte nicht validiert werden.")
          return
        }

        setAntragInfo(data as AntragInfo)
        setState("ready")
      } catch {
        setState("error")
        setError("Netzwerkfehler. Bitte versuche es erneut.")
      }
    }

    if (token) validateToken()
  }, [token])

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="mx-auto max-w-lg">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <XCircle className="mb-4 h-12 w-12 text-destructive" />
            <h2 className="mb-2 text-xl font-semibold">Link abgelaufen</h2>
            <p className="text-muted-foreground">
              Dieser Entscheidungslink ist nicht mehr gültig. Bitte kontaktiere
              den Kassier, falls der Antrag noch offen sein sollte.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === "already_finalized" && finalizedInfo) {
    const isApproved = finalizedInfo.finalStatus === "genehmigt"
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="mx-auto max-w-lg">
          <CardContent className="flex flex-col items-center py-12 text-center">
            {isApproved ? (
              <CheckCircle2 className="mb-4 h-12 w-12 text-green-600" />
            ) : (
              <XCircle className="mb-4 h-12 w-12 text-destructive" />
            )}
            <h2 className="mb-2 text-xl font-semibold">
              Antrag bereits abgeschlossen
            </h2>
            <p className="text-muted-foreground">
              Der Antrag wurde per Mehrheit{" "}
              <Badge variant={isApproved ? "default" : "destructive"}>
                {isApproved ? "genehmigt" : "abgelehnt"}
              </Badge>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === "already_decided") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="mx-auto max-w-lg">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-amber-500" />
            <h2 className="mb-2 text-xl font-semibold">Bereits entschieden</h2>
            <p className="text-muted-foreground">
              Du hast diesen Antrag bereits bewertet. Eine erneute Abstimmung ist
              nicht möglich.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="mx-auto max-w-lg">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
            <h2 className="mb-2 text-xl font-semibold">Fehler</h2>
            <p className="text-muted-foreground">
              {error || "Ein unerwarteter Fehler ist aufgetreten."}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {antragInfo && (
        <AntragEntscheidung
          token={token}
          antragInfo={antragInfo}
          preselectedDecision={preselectedDecision}
        />
      )}
    </div>
  )
}
