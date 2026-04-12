"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react"

interface TokenValidationResult {
  valid: boolean
  error?: string
  errorType?: "expired" | "used" | "decided" | "invalid"
  costRequest?: {
    id: string
    applicantName: string
    amount: string
    purpose: string
    createdAt: string
    status: string
  }
  approverRole?: string
  intent?: "genehmigt" | "abgelehnt"
  existingVote?: string
  voteSummary?: {
    total: number
    approved: number
    rejected: number
  }
}

interface VoteResult {
  success: boolean
  decision: string
  finalDecision?: string
  error?: string
}

interface AbstimmungsSeiteProps {
  token: string
}

function formatApproverRole(role: string): string {
  switch (role) {
    case "vorsitzender_1":
      return "1. Vorsitzende/r"
    case "vorsitzender_2":
      return "2. Vorsitzende/r"
    case "kassier":
      return "Kassier/in"
    default:
      return role
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function AbstimmungsSeite({ token }: AbstimmungsSeiteProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isVoting, setIsVoting] = useState(false)
  const [tokenData, setTokenData] = useState<TokenValidationResult | null>(null)
  const [voteResult, setVoteResult] = useState<VoteResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Token validieren beim Laden
  const validateToken = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/cost-requests/vote?token=${encodeURIComponent(token)}`
      )
      const data: TokenValidationResult = await response.json()

      if (!response.ok || !data.valid) {
        setTokenData(data)
        return
      }

      setTokenData(data)
    } catch {
      setError(
        "Verbindungsfehler. Bitte prüfen Sie Ihre Internetverbindung und laden Sie die Seite neu."
      )
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    validateToken()
  }, [validateToken])

  // Abstimmung absenden
  async function handleVote(decision: "genehmigt" | "abgelehnt") {
    setIsVoting(true)
    setError(null)

    try {
      const response = await fetch("/api/cost-requests/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decision }),
      })

      const data: VoteResult = await response.json()

      if (!response.ok) {
        setError(
          data.error || "Ihre Abstimmung konnte nicht gespeichert werden."
        )
        return
      }

      setVoteResult(data)
    } catch {
      setError(
        "Netzwerkfehler beim Absenden der Abstimmung. Bitte versuchen Sie es erneut."
      )
    } finally {
      setIsVoting(false)
    }
  }

  // Ladezustand
  if (isLoading) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Skeleton className="mx-auto h-7 w-48" />
          <Skeleton className="mx-auto mt-2 h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Separator />
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Netzwerkfehler ohne Token-Daten
  if (error && !tokenData) {
    return (
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // Token ungültig oder abgelaufen
  if (tokenData && !tokenData.valid) {
    const errorMessages: Record<string, { title: string; description: string }> =
      {
        expired: {
          title: "Link abgelaufen",
          description:
            "Dieser Abstimmungslink ist abgelaufen. Bitte kontaktieren Sie den Kassier direkt.",
        },
        used: {
          title: "Bereits abgestimmt",
          description: `Sie haben bereits abgestimmt: ${tokenData.existingVote === "genehmigt" ? "Genehmigt" : "Abgelehnt"}. Ihre Stimme wurde erfasst.`,
        },
        decided: {
          title: "Entscheidung bereits getroffen",
          description:
            "Über diesen Antrag wurde bereits entschieden. Ihre Stimme wird nicht mehr benötigt.",
        },
        invalid: {
          title: "Ungültiger Link",
          description:
            "Dieser Abstimmungslink ist ungültig. Bitte verwenden Sie den Link aus Ihrer E-Mail.",
        },
      }

    const msg = errorMessages[tokenData.errorType || "invalid"] ||
      errorMessages.invalid

    return (
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              {tokenData.errorType === "used" ? (
                <CheckCircle2 className="h-6 w-6 text-blue-600" aria-hidden="true" />
              ) : tokenData.errorType === "decided" ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
              )}
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">{msg.title}</h2>
              <p className="text-sm text-muted-foreground">{msg.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Erfolgreich abgestimmt
  if (voteResult) {
    const isApproved = voteResult.decision === "genehmigt"

    return (
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                isApproved ? "bg-green-100" : "bg-red-100"
              }`}
            >
              {isApproved ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" aria-hidden="true" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
              )}
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Abstimmung erfasst</h2>
              <p className="text-sm text-muted-foreground">
                Ihre Stimme wurde erfolgreich gespeichert:{" "}
                <strong>
                  {isApproved ? "Genehmigt" : "Abgelehnt"}
                </strong>
              </p>
              {voteResult.finalDecision && (
                <div className="mt-3 rounded-md border p-3">
                  <p className="text-sm font-medium">
                    Endgültige Entscheidung:{" "}
                    <Badge
                      variant={
                        voteResult.finalDecision === "genehmigt"
                          ? "default"
                          : "destructive"
                      }
                    >
                      {voteResult.finalDecision === "genehmigt"
                        ? "Genehmigt"
                        : "Abgelehnt"}
                    </Badge>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Die Mehrheit (2 von 3) wurde erreicht. Alle Beteiligten
                    werden per E-Mail informiert.
                  </p>
                </div>
              )}
              {!voteResult.finalDecision && (
                <p className="text-xs text-muted-foreground">
                  Die weiteren Genehmiger werden benachrichtigt. Sie erhalten
                  eine E-Mail, sobald die endgültige Entscheidung feststeht.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Antragsdetails + Abstimmungsbuttons
  const request = tokenData?.costRequest
  if (!request) return null

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-xl font-bold sm:text-2xl">
          Kostenübernahme-Antrag
        </CardTitle>
        <CardDescription>
          Abstimmung als{" "}
          <strong>
            {formatApproverRole(tokenData?.approverRole || "")}
          </strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Antragsdetails */}
        <div className="space-y-3 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Antragsteller</span>
            <span className="text-sm font-medium">{request.applicantName}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Betrag</span>
            <span className="text-sm font-semibold">{request.amount} EUR</span>
          </div>
          <Separator />
          <div>
            <span className="text-sm text-muted-foreground">
              Verwendungszweck
            </span>
            <p className="mt-1 text-sm">{request.purpose}</p>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Eingereicht am</span>
            <span className="text-sm">{formatDate(request.createdAt)}</span>
          </div>
        </div>

        {/* Abstimmungsstand */}
        {tokenData?.voteSummary && tokenData.voteSummary.total > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span>
              Bisheriger Stand: {tokenData.voteSummary.approved} Genehmigung(en),{" "}
              {tokenData.voteSummary.rejected} Ablehnung(en) von{" "}
              {tokenData.voteSummary.total} Stimme(n)
            </span>
          </div>
        )}

        {/* Bestätigungshinweis: der Link ist an eine Entscheidung gebunden */}
        {tokenData?.intent && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Sie sind im Begriff, diesen Antrag{" "}
              <strong>
                {tokenData.intent === "genehmigt" ? "zu genehmigen" : "abzulehnen"}
              </strong>
              . Falls Sie die andere Entscheidung treffen möchten, verwenden Sie
              bitte den entsprechenden Link aus Ihrer E-Mail.
            </AlertDescription>
          </Alert>
        )}

        {/* Bestätigungs-Button (nur die vom Token vorgegebene Aktion) */}
        <div className="pt-2">
          {tokenData?.intent === "genehmigt" ? (
            <Button
              onClick={() => handleVote("genehmigt")}
              disabled={isVoting}
              className="w-full bg-green-600 hover:bg-green-700"
              aria-label="Antrag genehmigen"
            >
              {isVoting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ThumbsUp className="mr-2 h-4 w-4" />
              )}
              Genehmigen bestätigen
            </Button>
          ) : (
            <Button
              onClick={() => handleVote("abgelehnt")}
              disabled={isVoting}
              variant="destructive"
              className="w-full"
              aria-label="Antrag ablehnen"
            >
              {isVoting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ThumbsDown className="mr-2 h-4 w-4" />
              )}
              Ablehnen bestätigen
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
