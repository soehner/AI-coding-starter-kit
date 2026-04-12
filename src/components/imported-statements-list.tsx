"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { AlertCircle, ExternalLink, FileText } from "lucide-react"
import type { BankStatement } from "@/lib/types"

interface ImportedStatementsListProps {
  statements: BankStatement[]
  isLoading: boolean
  error: string | null
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  } catch {
    return dateString
  }
}

function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateString
  }
}

export function ImportedStatementsList({
  statements,
  isLoading,
  error,
}: ImportedStatementsListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Importierte Kontoauszüge
        </CardTitle>
        <CardDescription>
          Übersicht aller bisher importierten PDF-Kontoauszüge.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!error && statements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              Noch keine Kontoauszüge importiert
            </p>
            <p className="text-xs text-muted-foreground">
              Laden Sie oben eine PDF-Datei hoch, um den ersten Import zu starten.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dateiname</TableHead>
                  <TableHead className="hidden sm:table-cell">Nr.</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Buchungen</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Importiert am
                  </TableHead>
                  <TableHead className="w-[100px]">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((stmt) => (
                  <TableRow key={stmt.id}>
                    <TableCell className="font-medium text-sm">
                      {stmt.file_name}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {stmt.statement_number}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDate(stmt.statement_date)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">
                        {stmt.transaction_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                      {formatDateTime(stmt.created_at)}
                    </TableCell>
                    <TableCell>
                      {stmt.file_path ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs"
                                asChild
                              >
                                <a
                                  href={stmt.file_path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Kontoauszug ${stmt.file_name} anschauen`}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Anschauen
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Kontoauszug in Seafile öffnen</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
