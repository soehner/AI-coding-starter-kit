"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { GenehmigungsEntscheidung } from "@/components/genehmigungs-entscheidung"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react"

interface ApprovalInfo {
  request_id: string
  note: string
  document_url: string | null
  document_name: string | null
  documents: Array<{ id: string; url: string; name: string }>
  created_at: string
  created_by_email: string
}

interface FinalizedInfo {
  finalStatus: "genehmigt" | "abgelehnt"
  linkType: "und" | "oder"
  decisions: Array<{
    role: "vorstand" | "zweiter_vorstand"
    decision: "genehmigt" | "abgelehnt"
    comment: string | null
  }>
}

type PageState =
  | "loading"
  | "ready"
  | "expired"
  | "already_decided"
  | "already_finalized"
  | "error"

function roleLabel(role: string): string {
  return role === "vorstand" ? "1. Vorstand" : "2. Vorstand"
}

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
  const [finalizedInfo, setFinalizedInfo] = useState<FinalizedInfo | null>(null)
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
            if (data.alreadyFinalized) {
              setFinalizedInfo({
                finalStatus: data.finalStatus,
                linkType: data.linkType,
                decisions: data.decisions || [],
              })
              setState("already_finalized")
              return
            }
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

  if (state === "already_finalized" && finalizedInfo) {
    const isApproved = finalizedInfo.finalStatus === "genehmigt"
    const linkReason =
      finalizedInfo.linkType === "oder"
        ? "Bei ODER-Verknüpfung reicht die Entscheidung einer einzigen Rolle — weitere Stimmen sind danach nicht mehr möglich."
        : "Bei UND-Verknüpfung wird der Antrag abgeschlossen, sobald eine Rolle ablehnt."
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="mx-auto max-w-lg">
          <CardContent className="flex flex-col items-center py-12 text-center">
            {isApproved ? (
              <CheckCircle2 className="mb-4 h-12 w-12 text-green-600" />
            ) : (
              <XCircle className="mb-4 h-12 w-12 text-destructive" />
            )}
            <h2 className="text-xl font-semibold mb-2">
              Antrag bereits abgeschlossen
            </h2>
            <p className="text-muted-foreground mb-4">
              Der Antrag wurde{" "}
              <Badge variant={isApproved ? "default" : "destructive"}>
                {isApproved ? "genehmigt" : "abgelehnt"}
              </Badge>
              .
            </p>
            {finalizedInfo.decisions.length > 0 && (
              <div className="w-full text-left space-y-2 rounded-md bg-muted p-3 mb-4">
                {finalizedInfo.decisions.map((d, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-medium">{roleLabel(d.role)}:</span>{" "}
                    <Badge
                      variant={
                        d.decision === "genehmigt" ? "default" : "destructive"
                      }
                    >
                      {d.decision}
                    </Badge>
                    {d.comment && (
                      <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                        {d.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{linkReason}</p>
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
