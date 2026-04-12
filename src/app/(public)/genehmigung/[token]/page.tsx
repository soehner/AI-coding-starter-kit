"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { GenehmigungsEntscheidung } from "@/components/genehmigungs-entscheidung"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, XCircle } from "lucide-react"

interface ApprovalInfo {
  request_id: string
  note: string
  document_url: string
  document_name: string
  created_at: string
  created_by_email: string
}

type PageState = "loading" | "ready" | "expired" | "already_decided" | "error"

export default function GenehmigungTokenPage() {
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
  const [approvalInfo, setApprovalInfo] = useState<ApprovalInfo | null>(null)
  const [existingDecision, setExistingDecision] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function validateToken() {
      try {
        const response = await fetch(`/api/approvals/decide/${token}`)
        const data = await response.json()

        if (!response.ok) {
          if (response.status === 401) {
            setState("expired")
            return
          }
          if (response.status === 410) {
            setState("already_decided")
            setExistingDecision(data.decision || null)
            return
          }
          setState("error")
          setError(data.error || "Token konnte nicht validiert werden.")
          return
        }

        setApprovalInfo(data as ApprovalInfo)
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
            <h2 className="text-xl font-semibold mb-2">Link abgelaufen</h2>
            <p className="text-muted-foreground">
              Dieser Genehmigungslink ist nicht mehr gültig.
              Der Antrag bleibt offen — bitte kontaktiere den Antragsteller.
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
            <h2 className="text-xl font-semibold mb-2">Bereits entschieden</h2>
            <p className="text-muted-foreground">
              Du hast diesen Antrag bereits{" "}
              {existingDecision && (
                <span className="font-medium">
                  {existingDecision === "genehmigt" ? "genehmigt" : "abgelehnt"}
                </span>
              )}
              . Eine erneute Abstimmung ist nicht möglich.
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
            <h2 className="text-xl font-semibold mb-2">Fehler</h2>
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
      {approvalInfo && (
        <GenehmigungsEntscheidung
          token={token}
          approvalInfo={approvalInfo}
          preselectedDecision={preselectedDecision}
        />
      )}
    </div>
  )
}
