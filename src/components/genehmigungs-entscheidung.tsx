"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  approvalDecisionSchema,
  type ApprovalDecisionInput,
} from "@/lib/validations/approval"

interface ApprovalInfo {
  request_id: string
  note: string
  document_url: string | null
  document_name: string | null
  documents: Array<{ id: string; url: string; name: string }>
  created_at: string
  created_by_email: string
}

interface GenehmigungsEntscheidungProps {
  token: string
  approvalInfo: ApprovalInfo
  /**
   * Vorausgewählte Entscheidung (aus E-Mail-Button-Klick übergeben).
   * Die Seite hebt den passenden Button optisch hervor, fordert aber
   * weiterhin eine explizite Bestätigung.
   */
  preselectedDecision?: "genehmigt" | "abgelehnt" | null
}

type DecisionState = "pending" | "submitting" | "success" | "error" | "already_decided" | "expired"

export function GenehmigungsEntscheidung({
  token,
  approvalInfo,
  preselectedDecision = null,
}: GenehmigungsEntscheidungProps) {
  const [state, setState] = useState<DecisionState>("pending")
  const [error, setError] = useState<string | null>(null)
  const [resultDecision, setResultDecision] = useState<string | null>(null)

  const form = useForm<ApprovalDecisionInput>({
    resolver: zodResolver(approvalDecisionSchema),
    defaultValues: {
      comment: "",
    },
  })

  async function submitDecision(decision: "genehmigt" | "abgelehnt") {
    const comment = form.getValues("comment")
    setState("submitting")
    setError(null)

    try {
      const response = await fetch(`/api/approvals/decide/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment || undefined }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 410) {
          setState("already_decided")
          setResultDecision(data.decision || null)
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
    } catch {
      setState("error")
      setError("Netzwerkfehler. Bitte versuche es erneut.")
    }
  }

  // Erfolgsseite
  if (state === "success") {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <CheckCircle2 className="mb-4 h-12 w-12 text-green-600" />
          <h2 className="text-xl font-semibold mb-2">Entscheidung gespeichert</h2>
          <p className="text-muted-foreground">
            Du hast den Antrag{" "}
            <Badge variant={resultDecision === "genehmigt" ? "default" : "destructive"}>
              {resultDecision === "genehmigt" ? "genehmigt" : "abgelehnt"}
            </Badge>
            . Der Antragsteller wird per E-Mail benachrichtigt.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Bereits entschieden
  if (state === "already_decided") {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-amber-500" />
          <h2 className="text-xl font-semibold mb-2">Bereits entschieden</h2>
          <p className="text-muted-foreground">
            Du hast diesen Antrag bereits{" "}
            {resultDecision && (
              <Badge variant={resultDecision === "genehmigt" ? "default" : "destructive"}>
                {resultDecision}
              </Badge>
            )}
            . Eine erneute Abstimmung ist nicht möglich.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Token abgelaufen
  if (state === "expired") {
    return (
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
    )
  }

  const isSubmitting = state === "submitting"

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Genehmigungsantrag</CardTitle>
        <CardDescription>
          Eingereicht von {approvalInfo.created_by_email} am{" "}
          {new Date(approvalInfo.created_at).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bemerkung */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Bemerkung</p>
          <p className="text-sm whitespace-pre-wrap rounded-md bg-muted p-3">
            {approvalInfo.note}
          </p>
        </div>

        {/* Belege */}
        {approvalInfo.documents.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {approvalInfo.documents.length > 1 ? "Belege" : "Beleg"}
            </p>
            <ul className="space-y-1">
              {approvalInfo.documents.map((doc) => (
                <li key={doc.id}>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline underline-offset-4 inline-flex items-center gap-1"
                  >
                    {doc.name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Kommentar */}
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

            {/* Fehler */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Hinweis bei vorausgewählter Aktion aus der E-Mail */}
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

            {/* Entscheidungs-Buttons */}
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
