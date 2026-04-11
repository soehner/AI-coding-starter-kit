"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js"
import type { UserProfile, UserPermissions, PermissionKey } from "@/lib/types"

const supabase = createClient()

interface AuthState {
  user: User | null
  profile: UserProfile | null
  permissions: UserPermissions | null
  isLoading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    permissions: null,
    isLoading: true,
    error: null,
  })

  const fetchProfileAndPermissions = useCallback(
    async (): Promise<{ profile: UserProfile | null; permissions: UserPermissions | null }> => {
      try {
        const res = await fetch("/api/auth/profile")
        if (!res.ok) {
          return { profile: null, permissions: null }
        }
        const data = await res.json()
        const profile: UserProfile = {
          id: data.id,
          email: data.email,
          role: data.role,
          created_at: data.created_at,
        }
        const permissions: UserPermissions = {
          user_id: data.id,
          edit_transactions: data.permissions.edit_transactions,
          export_excel: data.permissions.export_excel,
          import_statements: data.permissions.import_statements,
          updated_at: "",
        }
        return { profile, permissions }
      } catch {
        console.error("Fehler beim Laden des Profils")
        return { profile: null, permissions: null }
      }
    },
    []
  )

  useEffect(() => {
    const getSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user) {
          const { profile, permissions } = await fetchProfileAndPermissions()
          setState({
            user: session.user,
            profile,
            permissions,
            isLoading: false,
            error: profile ? null : "Profil konnte nicht geladen werden.",
          })
        } else {
          setState({ user: null, profile: null, permissions: null, isLoading: false, error: null })
        }
      } catch {
        setState({
          user: null,
          profile: null,
          permissions: null,
          isLoading: false,
          error: "Session konnte nicht geladen werden.",
        })
      }
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        const { profile, permissions } = await fetchProfileAndPermissions()
        setState({
          user: session.user,
          profile,
          permissions,
          isLoading: false,
          error: profile ? null : "Profil konnte nicht geladen werden.",
        })
      } else {
        setState({ user: null, profile: null, permissions: null, isLoading: false, error: null })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfileAndPermissions])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    window.location.assign("/login")
  }, [])

  const updatePassword = useCallback(
    async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) throw error
    },
    []
  )

  const hasPermission = useCallback(
    (permission: PermissionKey): boolean => {
      // Admins haben immer alle Berechtigungen
      if (state.profile?.role === "admin") return true
      // Betrachter: explizite Berechtigung prüfen
      if (!state.permissions) return false
      return state.permissions[permission] === true
    },
    [state.profile?.role, state.permissions]
  )

  return {
    ...state,
    signOut,
    updatePassword,
    isAdmin: state.profile?.role === "admin",
    isViewer: state.profile?.role === "viewer",
    hasPermission,
  }
}
