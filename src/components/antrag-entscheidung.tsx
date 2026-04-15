"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react"
import {
  antragDecisionSchema,
  type AntragDecisionInput,
} from "@/lib/validations/antrag"

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

interface AntragEntscheidungProps {
  token: string
  antragInfo: AntragInfo
  preselectedDecision?: "genehmigt" | "abgelehnt" | null
}

type DecisionState =
  | "pending"
  | "submitting"
  | "success"
  | "error"
  | "already_decided"
  | "already_finalized"
  | "expired"

function formatEuroCents(cents: number): string {
  return (
    (cents / 100).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  )
}

export function AntragEntscheidung({
  token,
  antragInfo,
  preselectedDecision = null,
}: AntragEntscheidungProps) {
  const [state, setState] = useState<DecisionState>("pending")
  const [error, setError] = useState<string | null>(null)
  const [resultDecision, setResultDecision] = useState<string | null>(null)
  const [finalStatus, setFinalStatus] = useState<"genehmigt" | "abgelehnt" | "offen" | null>(null)
  const [finalizedInfo, setFinalizedInfo] = useState<FinalizedInfo | null>(null)

  const form = useForm<AntragDecisionInput>({
    resolver: zodResolver(antragDecisionSchema),
    defaultValues: {
      comment: "",
    },
  })

  async function submitDecision(decision: "genehmigt" | "abgelehnt") {
    const comment = form.getValues("comment")
    setState("submitting")
    setError(null)

    try {
      const response = await fetch(`/api/antraege/decide/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment || undefined }),
      })

      const data = await response.json()

      if (!response.ok) {
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
        if (response.status === 401) {
          setState("expired")
          return
        }
        setState("error")
        setError(data.error || "Entscheidung konnte nicht gespeichert werden.")
        return
      }

      setState("success")
      setResultDecision(decision)
      setFinalStatus(data.finalStatus ?? null)
    } catch {
      setState("error")
      setError("Netzwerkfehler. Bitte versuche es erneut.")
    }
  }

  if (state === "success") {
    const finalized = finalStatus && finalStatus !== "offen"
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <CheckCircle2 className="mb-4 h-12 w-12 text-green-600" />
          <h2 className="mb-2 text-xl font-semibold">
            Entscheidung gespeichert
          </h2>
          <p className="text-muted-foreground">
            Du hast den Antrag{" "}
            <Badge
              variant={resultDecision === "genehmigt" ? "default" : "destructive"}
            >
              {resultDecision === "genehmigt" ? "genehmigt" : "abgelehnt"}
            </Badge>
            .
          </p>
          {finalized && (
            <p className="mt-4 text-sm text-muted-foreground">
              Per Mehrheit wurde der Antrag insgesamt{" "}
              <strong>{finalStatus}</strong>. Der Antragsteller wurde per E-Mail
              benachrichtigt.
            </p>
          )}
          {!finalized && (
            <p className="mt-4 text-sm text-muted-foreground">
              Es warten noch weitere Genehmiger auf ihre Entscheidung.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (state === "already_finalized" && finalizedInfo) {
    const isApproved = finalizedInfo.finalStatus === "genehmigt"
    return (
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
    )
  }

  if (state === "already_decided") {
    return (
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
    )
  }

  if (state === "expired") {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <XCircle className="mb-4 h-12 w-12 text-destructive" />
          <h2 className="mb-2 text-xl font-semibold">Link abgelaufen</h2>
          <p className="text-muted-foreground">
            Dieser Entscheidungslink ist nicht mehr gültig.
          </p>
        </CardContent>
      </Card>
    )
  }

  const isSubmitting = state === "submitting"

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Kostenübernahme-Antrag</CardTitle>
        <CardDescription>
          Eingereicht von {antragInfo.applicant_name} am{" "}
          {new Date(antragInfo.created_at).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 rounded-md border p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Antragsteller</span>
            <span className="text-right font-medium">
              {antragInfo.applicant_name}
              <br />
              <span className="text-xs text-muted-foreground">
                {antragInfo.applicant_email}
              </span>
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Betrag</span>
            <span className="font-mono font-semibold">
              {formatEuroCents(antragInfo.amount_cents)}
            </span>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Verwendungszweck
          </p>
          <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
            {antragInfo.purpose}
          </p>
        </div>

        {antragInfo.documents.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {antragInfo.documents.length > 1 ? "Anhänge" : "Anhang"}
            </p>
            <ul className="space-y-1">
              {antragInfo.documents.map((doc) => (
                <li key={doc.id}>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-4"
                  >
                    {doc.name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kommentar (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Begründung oder Anmerkung..."
                      rows={3}
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {preselectedDecision && (
              <Alert>
                <AlertDescription>
                  Du hast in der E-Mail auf{" "}
                  <strong>
                    {preselectedDecision === "genehmigt"
                      ? "Genehmigen"
                      : "Nicht genehmigen"}
                  </strong>{" "}
                  geklickt. Bitte bestätige deine Auswahl unten.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={() => submitDecision("genehmigt")}
                disabled={isSubmitting}
                className={`flex-1 bg-green-600 hover:bg-green-700 ${
                  preselectedDecision === "genehmigt"
                    ? "ring-2 ring-green-400 ring-offset-2"
                    : ""
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsUp className="mr-2 h-4 w-4" />
                )}
                Genehmigen
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => submitDecision("abgelehnt")}
                disabled={isSubmitting}
                className={`flex-1 ${
                  preselectedDecision === "abgelehnt"
                    ? "ring-2 ring-red-400 ring-offset-2"
                    : ""
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsDown className="mr-2 h-4 w-4" />
                )}
                Ablehnen
              </Button>
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  )
}
