"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import type { UserProfile } from "@/lib/types"

interface AuthState {
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
    error: null,
  })

  const supabase = useMemo(() => createClient(), [])

  const fetchProfile = useCallback(
    async (userId: string): Promise<UserProfile | null> => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, role, created_at")
        .eq("id", userId)
        .single()

      if (error) {
        console.error("Fehler beim Laden des Profils:", error.message)
        return null
      }
      return data as UserProfile
    },
    [supabase]
  )

  useEffect(() => {
    const getSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user) {
          const profile = await fetchProfile(session.user.id)
          setState({
            user: session.user,
            profile,
            isLoading: false,
            error: profile ? null : "Profil konnte nicht geladen werden.",
          })
        } else {
          setState({ user: null, profile: null, isLoading: false, error: null })
        }
      } catch {
        setState({
          user: null,
          profile: null,
          isLoading: false,
          error: "Session konnte nicht geladen werden.",
        })
      }
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        setState({
          user: session.user,
          profile,
          isLoading: false,
          error: profile ? null : "Profil konnte nicht geladen werden.",
        })
      } else {
        setState({ user: null, profile: null, isLoading: false, error: null })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    window.location.assign("/login")
  }, [supabase])

  const updatePassword = useCallback(
    async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) throw error
    },
    [supabase]
  )

  return {
    ...state,
    signOut,
    updatePassword,
    isAdmin: state.profile?.role === "admin",
    isViewer: state.profile?.role === "viewer",
  }
}
