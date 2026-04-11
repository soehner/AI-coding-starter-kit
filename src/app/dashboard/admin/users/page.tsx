"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { InviteUserDialog } from "@/components/invite-user-dialog"
import { UsersTable, type UserEntry } from "@/components/users-table"
import { Skeleton } from "@/components/ui/skeleton"
import type { UserRole, PermissionKey, UserPermissions } from "@/lib/types"

export default function AdminUsersPage() {
  const { user, profile, isLoading: authLoading, isAdmin } = useAuth()
  const router = useRouter()

  const [users, setUsers] = useState<UserEntry[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/users")
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Benutzer konnten nicht geladen werden.")
        return
      }

      const userEntries: UserEntry[] = (data as Array<{
        id: string
        email: string
        role: string
        created_at: string
        last_sign_in_at: string | null
        permissions?: UserPermissions | null
      }>).map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role as UserRole,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        permissions: u.permissions ?? null,
      }))

      setUsers(userEntries)
    } catch {
      setError("Netzwerkfehler beim Laden der Benutzer.")
    } finally {
      setIsLoadingUsers(false)
    }
  }, [])

  // Redirect falls kein Admin
  useEffect(() => {
    if (!authLoading && (!profile || !isAdmin)) {
      router.replace("/dashboard")
    }
  }, [authLoading, profile, isAdmin, router])

  // Benutzer laden
  useEffect(() => {
    if (isAdmin) {
      fetchUsers()
    }
  }, [isAdmin, fetchUsers])

  // Lade-Zustand während Auth noch läuft
  if (authLoading) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Nicht-Admin: nichts anzeigen (Redirect passiert im useEffect)
  if (!isAdmin || !user) {
    return null
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Rolle konnte nicht geändert werden.")
    }

    // Lokale Liste aktualisieren
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    )
  }

  async function handlePermissionChange(
    userId: string,
    permission: PermissionKey,
    value: boolean
  ) {
    const response = await fetch(`/api/admin/users/${userId}/permissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permission, value }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Berechtigung konnte nicht geändert werden.")
    }

    // Lokale Liste aktualisieren
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              permissions: {
                ...(u.permissions || {
                  user_id: userId,
                  edit_transactions: false,
                  export_excel: false,
                  import_statements: false,
                  updated_at: new Date().toISOString(),
                }),
                [permission]: value,
                updated_at: new Date().toISOString(),
              },
            }
          : u
      )
    )
  }

  async function handleDelete(userId: string) {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Benutzer konnte nicht gelöscht werden.")
    }

    // Aus lokaler Liste entfernen
    setUsers((prev) => prev.filter((u) => u.id !== userId))
  }

  return (
    <div className="container px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Benutzerverwaltung
          </h2>
          <p className="text-sm text-muted-foreground">
            Verwalte Benutzer und ihre Rollen.
          </p>
        </div>
        <InviteUserDialog onInvited={fetchUsers} />
      </div>

      <UsersTable
        users={users}
        currentUserId={user.id}
        isLoading={isLoadingUsers}
        error={error}
        onRoleChange={handleRoleChange}
        onDelete={handleDelete}
        onPermissionChange={handlePermissionChange}
      />
    </div>
  )
}
