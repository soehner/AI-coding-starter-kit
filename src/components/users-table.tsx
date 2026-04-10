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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Loader2, Trash2 } from "lucide-react"
import type { UserRole } from "@/lib/types"

export interface UserEntry {
  id: string
  email: string
  role: UserRole
  created_at: string
  last_sign_in_at?: string | null
}

interface UsersTableProps {
  users: UserEntry[]
  currentUserId: string
  isLoading: boolean
  error: string | null
  onRoleChange: (userId: string, newRole: UserRole) => Promise<void>
  onDelete: (userId: string) => Promise<void>
}

function getRoleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Administrator"
    case "viewer":
      return "Betrachter"
    default:
      return role
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function getUserStatus(lastSignIn: string | null | undefined): {
  label: string
  variant: "default" | "secondary" | "outline"
} {
  if (lastSignIn) {
    return { label: "Aktiv", variant: "default" }
  }
  return { label: "Eingeladen", variant: "secondary" }
}

export function UsersTable({
  users,
  currentUserId,
  isLoading,
  error,
  onRoleChange,
  onDelete,
}: UsersTableProps) {
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [deletingUser, setDeletingUser] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setUpdatingRole(userId)
    setActionError(null)
    try {
      await onRoleChange(userId, newRole)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Rolle konnte nicht geaendert werden."
      )
    } finally {
      setUpdatingRole(null)
    }
  }

  async function handleDelete(userId: string) {
    setDeletingUser(userId)
    setActionError(null)
    try {
      await onDelete(userId)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Benutzer konnte nicht geloescht werden."
      )
    } finally {
      setDeletingUser(null)
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

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">
          Keine Benutzer gefunden. Lade einen Benutzer ein, um zu beginnen.
        </p>
      </div>
    )
  }

  const isSelf = (userId: string) => userId === currentUserId

  return (
    <div className="space-y-4">
      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-Mail</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">
                Registriert am
              </TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const status = getUserStatus(user.last_sign_in_at)
              const isCurrentUser = isSelf(user.id)
              const isUpdating = updatingRole === user.id
              const isDeleting = deletingUser === user.id

              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {user.email}
                      {isCurrentUser && (
                        <Badge variant="outline" className="text-xs">
                          Du
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {isCurrentUser ? (
                      <span className="text-sm text-muted-foreground">
                        {getRoleLabel(user.role)}
                      </span>
                    ) : (
                      <Select
                        value={user.role}
                        onValueChange={(value: UserRole) =>
                          handleRoleChange(user.id, value)
                        }
                        disabled={isUpdating || isDeleting}
                      >
                        <SelectTrigger
                          className="w-[150px]"
                          aria-label={`Rolle von ${user.email} aendern`}
                        >
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="viewer">Betrachter</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {isCurrentUser ? (
                      <span className="text-xs text-muted-foreground">--</span>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isDeleting}
                            aria-label={`${user.email} loeschen`}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Benutzer loeschen?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Der Benutzer{" "}
                              <strong>{user.email}</strong> wird
                              unwiderruflich geloescht. Dieser Vorgang kann nicht
                              rueckgaengig gemacht werden.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Loeschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
