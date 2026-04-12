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
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { UserPermissionsPanel } from "@/components/user-permissions-panel"
import { AlertCircle, ChevronDown, Loader2, ShieldCheck, ShieldOff, Trash2 } from "lucide-react"
import type { UserRole, UserPermissions, PermissionKey } from "@/lib/types"

export interface UserEntry {
  id: string
  email: string
  role: UserRole
  created_at: string
  last_sign_in_at?: string | null
  permissions?: UserPermissions | null
  mfa_enabled?: boolean
  ist_vorstand?: boolean
  ist_zweiter_vorstand?: boolean
}

interface UsersTableProps {
  users: UserEntry[]
  currentUserId: string
  isLoading: boolean
  error: string | null
  onRoleChange: (userId: string, newRole: UserRole) => Promise<void>
  onDelete: (userId: string) => Promise<void>
  onPermissionChange?: (userId: string, permission: PermissionKey, value: boolean) => Promise<void>
  onExtraRoleChange?: (
    userId: string,
    role: "ist_vorstand" | "ist_zweiter_vorstand",
    value: boolean
  ) => Promise<void>
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
  onPermissionChange,
  onExtraRoleChange,
}: UsersTableProps) {
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [updatingExtraRole, setUpdatingExtraRole] = useState<string | null>(null)
  const [deletingUser, setDeletingUser] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())

  async function handleExtraRoleChange(
    userId: string,
    role: "ist_vorstand" | "ist_zweiter_vorstand",
    value: boolean
  ) {
    if (!onExtraRoleChange) return
    setUpdatingExtraRole(`${userId}-${role}`)
    setActionError(null)
    try {
      await onExtraRoleChange(userId, role, value)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Zusatzrolle konnte nicht geändert werden."
      )
    } finally {
      setUpdatingExtraRole(null)
    }
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setUpdatingRole(userId)
    setActionError(null)
    try {
      await onRoleChange(userId, newRole)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Rolle konnte nicht geändert werden."
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
        err instanceof Error ? err.message : "Benutzer konnte nicht gelöscht werden."
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

  function toggleExpanded(userId: string) {
    setExpandedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

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
              <TableHead className="hidden lg:table-cell">Zusatzrollen</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">2FA</TableHead>
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
              const isViewer = user.role === "viewer"
              const canExpand = isViewer && !isCurrentUser && !!onPermissionChange
              const isExpanded = expandedUsers.has(user.id)

              return (
                <Collapsible
                  key={user.id}
                  open={isExpanded && canExpand}
                  onOpenChange={() => canExpand && toggleExpanded(user.id)}
                  asChild
                >
                  <>
                    <TableRow
                      className={canExpand ? "cursor-pointer" : undefined}
                      onClick={canExpand ? () => toggleExpanded(user.id) : undefined}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {canExpand && (
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                aria-label={`Berechtigungen von ${user.email} ${isExpanded ? "zuklappen" : "aufklappen"}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleExpanded(user.id)
                                }}
                              >
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform duration-200 ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </Button>
                            </CollapsibleTrigger>
                          )}
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
                              aria-label={`Rolle von ${user.email} ändern`}
                              onClick={(e) => e.stopPropagation()}
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
                      <TableCell
                        className="hidden lg:table-cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {onExtraRoleChange && !isCurrentUser ? (
                          <div className="flex flex-col gap-1">
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Checkbox
                                checked={user.ist_vorstand ?? false}
                                onCheckedChange={(checked) =>
                                  handleExtraRoleChange(
                                    user.id,
                                    "ist_vorstand",
                                    checked === true
                                  )
                                }
                                disabled={
                                  updatingExtraRole === `${user.id}-ist_vorstand`
                                }
                                aria-label={`Vorstand-Rolle für ${user.email}`}
                              />
                              Vorstand
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Checkbox
                                checked={user.ist_zweiter_vorstand ?? false}
                                onCheckedChange={(checked) =>
                                  handleExtraRoleChange(
                                    user.id,
                                    "ist_zweiter_vorstand",
                                    checked === true
                                  )
                                }
                                disabled={
                                  updatingExtraRole === `${user.id}-ist_zweiter_vorstand`
                                }
                                aria-label={`2. Vorstand-Rolle für ${user.email}`}
                              />
                              2. Vorstand
                            </label>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                            {user.ist_vorstand && <span>Vorstand</span>}
                            {user.ist_zweiter_vorstand && <span>2. Vorstand</span>}
                            {!user.ist_vorstand && !user.ist_zweiter_vorstand && (
                              <span>—</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {user.mfa_enabled ? (
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Aktiv
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <ShieldOff className="h-3 w-3" />
                            Inaktiv
                          </Badge>
                        )}
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
                                aria-label={`${user.email} löschen`}
                                onClick={(e) => e.stopPropagation()}
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
                                  Benutzer löschen?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Der Benutzer{" "}
                                  <strong>{user.email}</strong> wird
                                  unwiderruflich gelöscht. Dieser Vorgang kann nicht
                                  rückgängig gemacht werden.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(user.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Löschen
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Aufklapp-Bereich: Feature-Berechtigungen */}
                    {canExpand && (
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell colSpan={7} className="p-0">
                            <UserPermissionsPanel
                              userId={user.id}
                              userEmail={user.email}
                              permissions={user.permissions ?? null}
                              onPermissionChange={onPermissionChange}
                            />
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    )}
                  </>
                </Collapsible>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
