"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { GenehmigungResubmitDialog } from "@/components/genehmigung-resubmit-dialog"
import {
  AlertCircle,
  ChevronDown,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
} from "lucide-react"
import type { ApprovalRequestWithDecisions, ApprovalStatus, ApprovalRoleType } from "@/lib/types"

interface GenehmigungTabellProps {
  requests: ApprovalRequestWithDecisions[]
  isLoading: boolean
  error: string | null
  isAdmin: boolean
  onRefresh?: () => Promise<void> | void
  onRetrySend?: (requestId: string) => Promise<void>
}

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  offen: "Offen",
  genehmigt: "Genehmigt",
  abgelehnt: "Abgelehnt",
  entwurf: "Entwurf",
}

const STATUS_VARIANTS: Record<ApprovalStatus, "default" | "secondary" | "destructive" | "outline"> = {
  offen: "secondary",
  genehmigt: "default",
  abgelehnt: "destructive",
  entwurf: "outline",
}

const ROLE_LABELS: Record<ApprovalRoleType, string> = {
  vorstand: "Vorstand",
  zweiter_vorstand: "2. Vorstand",
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function GenehmigungTabelle({
  requests,
  isLoading,
  error,
  isAdmin,
  onRefresh,
  onRetrySend,
}: GenehmigungTabellProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [retrying, setRetrying] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [resubmitDialogRequest, setResubmitDialogRequest] =
    useState<ApprovalRequestWithDecisions | null>(null)

  const filteredRequests = statusFilter === "all"
    ? requests
    : requests.filter((r) => r.status === statusFilter)

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleRetrySend(requestId: string) {
    if (!onRetrySend) return
    setRetrying(requestId)
    setActionError(null)
    try {
      await onRetrySend(requestId)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "E-Mail-Versand erneut fehlgeschlagen."
      )
    } finally {
      setRetrying(null)
    }
  }

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

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filterleiste */}
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        role="search"
        aria-label="Anträge filtern"
      >
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Status filtern">
            <SelectValue placeholder="Alle Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="offen">Offen</SelectItem>
            <SelectItem value="genehmigt">Genehmigt</SelectItem>
            <SelectItem value="abgelehnt">Abgelehnt</SelectItem>
            <SelectItem value="entwurf">Entwurf</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {filteredRequests.length} {filteredRequests.length === 1 ? "Antrag" : "Anträge"}
        </p>
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            {statusFilter === "all"
              ? "Noch keine Genehmigungsanträge vorhanden."
              : `Keine Anträge mit Status „${STATUS_LABELS[statusFilter as ApprovalStatus]}".`}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Datum</TableHead>
                <TableHead>Bemerkung</TableHead>
                <TableHead className="hidden sm:table-cell">Rollen</TableHead>
                <TableHead className="hidden md:table-cell">Verknüpfung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request) => {
                const isExpanded = expandedRows.has(request.id)
                const isRetryLoading = retrying === request.id

                return (
                  <Collapsible
                    key={request.id}
                    open={isExpanded}
                    onOpenChange={() => toggleRow(request.id)}
                    asChild
                  >
                    <>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleRow(request.id)}
                      >
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              aria-label={isExpanded ? "Details zuklappen" : "Details aufklappen"}
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleRow(request.id)
                              }}
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(request.created_at)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {request.note}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {request.required_roles
                            .map((r) => ROLE_LABELS[r])
                            .join(", ")}
                        </TableCell>
                        <TableCell className="hidden md:table-cell uppercase text-xs font-medium">
                          {request.required_roles.length > 1
                            ? request.link_type
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[request.status]}>
                            {STATUS_LABELS[request.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {request.document_url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                                aria-label="Beleg öffnen"
                              >
                                <a
                                  href={request.document_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {isAdmin && request.status === "entwurf" && onRetrySend && (
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isRetryLoading}
                                onClick={() => handleRetrySend(request.id)}
                                aria-label="E-Mail-Versand erneut auslösen"
                              >
                                {isRetryLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {isAdmin && request.status === "abgelehnt" && onRefresh && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setResubmitDialogRequest(request)}
                                aria-label="Antrag überarbeiten und erneut einreichen"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Detail-Bereich */}
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell colSpan={7} className="p-4">
                            <div className="space-y-4">
                              {/* Bemerkung (voll) */}
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Bemerkung
                                </p>
                                <p className="text-sm whitespace-pre-wrap">
                                  {request.note}
                                </p>
                              </div>

                              {/* Beleg */}
                              {request.document_url && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">
                                    Beleg
                                  </p>
                                  <a
                                    href={request.document_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary underline underline-offset-4 inline-flex items-center gap-1"
                                  >
                                    {request.document_name}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}

                              {/* Entscheidungen */}
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  Entscheidungen
                                </p>
                                {request.approval_decisions.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">
                                    Noch keine Entscheidungen.
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {request.approval_decisions.map((decision) => (
                                      <div
                                        key={decision.id}
                                        className="flex flex-col gap-1 rounded-md border p-3 text-sm"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium">
                                            {ROLE_LABELS[decision.approver_role]}
                                            {decision.approver_email && (
                                              <span className="font-normal text-muted-foreground ml-1">
                                                ({decision.approver_email})
                                              </span>
                                            )}
                                          </span>
                                          <Badge
                                            variant={
                                              decision.decision === "genehmigt"
                                                ? "default"
                                                : "destructive"
                                            }
                                          >
                                            {decision.decision === "genehmigt"
                                              ? "Genehmigt"
                                              : "Abgelehnt"}
                                          </Badge>
                                        </div>
                                        {decision.comment && (
                                          <p className="text-muted-foreground">
                                            {decision.comment}
                                          </p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                          {formatDateTime(decision.decided_at)}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Erstellt am / von */}
                              <div className="text-xs text-muted-foreground">
                                Erstellt am {formatDateTime(request.created_at)}
                                {request.created_by_email && (
                                  <> von {request.created_by_email}</>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Resubmit-Dialog (BUG-3) */}
      {resubmitDialogRequest && (
        <GenehmigungResubmitDialog
          request={resubmitDialogRequest}
          open={resubmitDialogRequest !== null}
          onOpenChange={(open) => {
            if (!open) setResubmitDialogRequest(null)
          }}
          onSuccess={async () => {
            if (onRefresh) await onRefresh()
            setResubmitDialogRequest(null)
          }}
        />
      )}
    </div>
  )
}
