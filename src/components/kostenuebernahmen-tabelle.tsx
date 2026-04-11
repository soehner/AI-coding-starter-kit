"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  MailWarning,
  Inbox,
} from "lucide-react"
import type {
  CostRequestWithVotes,
  CostRequestStatus,
  ApprovalRole,
} from "@/lib/types"

interface KostenuebernahmenTabelleProps {
  requests: CostRequestWithVotes[]
  isLoading: boolean
  error: string | null
  onRetryEmail: (requestId: string) => Promise<void>
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatApprovalRole(role: ApprovalRole): string {
  switch (role) {
    case "vorsitzender_1":
      return "1. Vors."
    case "vorsitzender_2":
      return "2. Vors."
    case "kassier":
      return "Kassier"
    default:
      return role
  }
}

function StatusBadge({ status }: { status: CostRequestStatus }) {
  switch (status) {
    case "offen":
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Offen
        </Badge>
      )
    case "genehmigt":
      return (
        <Badge className="gap-1 bg-green-600 hover:bg-green-700">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Genehmigt
        </Badge>
      )
    case "abgelehnt":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" aria-hidden="true" />
          Abgelehnt
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function EmailStatusBadge({
  status,
}: {
  status: "ausstehend" | "gesendet" | "fehlgeschlagen"
}) {
  switch (status) {
    case "gesendet":
      return (
        <Badge variant="outline" className="text-green-600">
          Gesendet
        </Badge>
      )
    case "fehlgeschlagen":
      return (
        <Badge variant="destructive" className="gap-1">
          <MailWarning className="h-3 w-3" aria-hidden="true" />
          Fehler
        </Badge>
      )
    case "ausstehend":
      return <Badge variant="secondary">Ausstehend</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function VoteSummary({
  votes,
}: {
  votes: CostRequestWithVotes["cost_request_votes"]
}) {
  if (!votes || votes.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">Keine Stimmen</span>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1">
        {votes.map((vote) => (
          <Tooltip key={vote.approval_role}>
            <TooltipTrigger asChild>
              <Badge
                variant={
                  vote.decision === "genehmigt" ? "default" : "destructive"
                }
                className={`text-xs ${
                  vote.decision === "genehmigt"
                    ? "bg-green-600 hover:bg-green-700"
                    : ""
                }`}
              >
                {formatApprovalRole(vote.approval_role)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {formatApprovalRole(vote.approval_role)}:{" "}
                {vote.decision === "genehmigt" ? "Genehmigt" : "Abgelehnt"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(vote.voted_at)}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}

export function KostenuebernahmenTabelle({
  requests,
  isLoading,
  error,
  onRetryEmail,
}: KostenuebernahmenTabelleProps) {
  // Ladezustand
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  // Fehlerzustand
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // Leerer Zustand
  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-12">
        <Inbox className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <div className="text-center">
          <p className="text-sm font-medium">
            Keine Kostenübernahme-Anträge vorhanden
          </p>
          <p className="text-xs text-muted-foreground">
            Sobald Anträge über das öffentliche Formular eingereicht werden,
            erscheinen sie hier.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Antragsteller</TableHead>
            <TableHead className="hidden sm:table-cell">E-Mail</TableHead>
            <TableHead className="text-right">Betrag</TableHead>
            <TableHead className="hidden md:table-cell">
              Verwendungszweck
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Stimmen</TableHead>
            <TableHead className="hidden sm:table-cell">E-Mail</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="whitespace-nowrap text-sm">
                {formatDate(request.created_at)}
              </TableCell>
              <TableCell className="font-medium">
                {request.applicant_first_name} {request.applicant_last_name}
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                {request.applicant_email}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-mono text-sm">
                {formatCents(request.amount_cents)} EUR
              </TableCell>
              <TableCell
                className="hidden max-w-[200px] truncate text-sm md:table-cell"
                title={request.purpose}
              >
                {request.purpose}
              </TableCell>
              <TableCell>
                <StatusBadge status={request.status} />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <VoteSummary votes={request.cost_request_votes} />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <EmailStatusBadge status={request.email_status} />
              </TableCell>
              <TableCell>
                {request.email_status === "fehlgeschlagen" && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onRetryEmail(request.id)}
                          aria-label="E-Mail-Versand wiederholen"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        E-Mail-Versand wiederholen
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
