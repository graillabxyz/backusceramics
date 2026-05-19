"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface AppUser {
  id: string
  name: string | null
  email: string
  role: "ADMIN" | "USER"
  image?: string | null
}

interface AuthContextValue {
  user: AppUser | null
  supabaseUser: SupabaseUser | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
  isAuthModalOpen: boolean
  openAuthModal: () => void
  closeAuthModal: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  supabaseUser: null,
  isLoading: true,
  isAuthenticated: false,
  logout: async () => {},
  isAuthModalOpen: false,
  openAuthModal: () => {},
  closeAuthModal: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setSupabaseUser(user)

      if (user) {
        // Fetch our app-level user data (with role) from our API
        await fetchAppUser(user.email!)
      }
      setIsLoading(false)
    }

    getSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null
      setSupabaseUser(user)

      if (user) {
        await fetchAppUser(user.email!)
        setIsAuthModalOpen(false) // Close modal upon successful sign-in
      } else {
        setAppUser(null)
      }
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getFallbackUser = (user: SupabaseUser): AppUser => ({
    id: user.id,
    email: user.email ?? "",
    name: user.user_metadata?.full_name || user.user_metadata?.name || null,
    image: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    role: "USER",
  })

  const fetchAppUser = async (email: string) => {
    try {
      const res = await fetch("/api/me")
      if (res.ok) {
        const data = await res.json()
        setAppUser(data.user)
        return
      }
    } catch (error) {
      console.error("Failed to load app user", error)
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.email === email) {
      setAppUser(getFallbackUser(user))
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setSupabaseUser(null)
    setAppUser(null)
    window.location.href = "/"
  }

  const openAuthModal = () => setIsAuthModalOpen(true)
  const closeAuthModal = () => setIsAuthModalOpen(false)

  return (
    <AuthContext.Provider
      value={{
        user: appUser,
        supabaseUser,
        isLoading,
        isAuthenticated: !!supabaseUser,
        logout,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
