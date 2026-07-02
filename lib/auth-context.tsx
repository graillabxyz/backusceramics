"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { consumeAuthReturnToCookie } from "@/lib/auth-redirect"
import type { AppRole } from "@/lib/permissions"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface AppUser {
  id: string
  name: string | null
  email: string
  role: AppRole
  image?: string | null
}

interface AuthContextValue {
  user: AppUser | null
  supabaseUser: SupabaseUser | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
  isAuthModalOpen: boolean
  authRedirectPath: string | null
  openAuthModal: (redirectPath?: string) => void
  closeAuthModal: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  supabaseUser: null,
  isLoading: true,
  isAuthenticated: false,
  logout: async () => {},
  isAuthModalOpen: false,
  authRedirectPath: null,
  openAuthModal: () => {},
  closeAuthModal: () => {},
})

const AUTH_REQUEST_TIMEOUT_MS = 8000
const APP_USER_CACHE_KEY = "bc_app_user"

function timeoutAfter<T>(ms: number, label: string): Promise<T> {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(`${label} timed out`)), ms)
  })
}

async function withTimeout<T>(promise: Promise<T>, label: string, ms = AUTH_REQUEST_TIMEOUT_MS) {
  return Promise.race([promise, timeoutAfter<T>(ms, label)])
}

function readCachedAppUser(user: SupabaseUser): AppUser | null {
  try {
    const rawValue = window.localStorage.getItem(APP_USER_CACHE_KEY)
    if (!rawValue) return null

    const cachedUser = JSON.parse(rawValue) as AppUser
    if (cachedUser.id === user.id || (user.email && cachedUser.email === user.email)) {
      return cachedUser
    }
  } catch {
    // Ignore malformed or blocked storage; auth still resolves from Supabase.
  }

  return null
}

function writeCachedAppUser(user: AppUser | null) {
  try {
    if (user) {
      window.localStorage.setItem(APP_USER_CACHE_KEY, JSON.stringify(user))
    } else {
      window.localStorage.removeItem(APP_USER_CACHE_KEY)
    }
  } catch {
    // Storage is only a UI speed-up, not part of auth correctness.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authRedirectPath, setAuthRedirectPath] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const redirectToStoredAuthReturn = () => {
    const returnTo = consumeAuthReturnToCookie(null)
    if (!returnTo) return false

    const currentPath = window.location.pathname + window.location.search
    if (returnTo !== currentPath) {
      window.location.assign(returnTo)
      return true
    }

    return false
  }

  const getFallbackUser = (user: SupabaseUser): AppUser => ({
    id: user.id,
    email: user.email ?? "",
    name: user.user_metadata?.full_name || user.user_metadata?.name || null,
    image: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    role: "USER",
  })

  const fetchAppUser = async (supabaseUser: SupabaseUser) => {
    const email = supabaseUser.email ?? ""
    const cachedUser = readCachedAppUser(supabaseUser)

    if (cachedUser) {
      setAppUser(cachedUser)
    }

    if (email) {
      setAppUser((current) => current?.id === supabaseUser.id ? current : cachedUser || getFallbackUser(supabaseUser))
    }

    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS)
      const res = await fetch("/api/me", { signal: controller.signal }).finally(() => {
        window.clearTimeout(timeout)
      })

      if (res.ok) {
        const data = await res.json()
        setAppUser(data.user)
        writeCachedAppUser(data.user)
        return
      }
    } catch (error) {
      console.error("Failed to load app user", error)
    }

    if (email && !cachedUser) {
      setAppUser(getFallbackUser(supabaseUser))
    }
  }

  useEffect(() => {
    // Get initial session. Reading the local session first gives the UI an
    // immediate signed-in state while the trusted profile/role lookup finishes.
    const getSession = async () => {
      let quickUser: SupabaseUser | null = null

      try {
        const {
          data: { session },
        } = await withTimeout(supabase.auth.getSession(), "Supabase session", 2500)

        quickUser = session?.user ?? null
        if (quickUser) {
          setSupabaseUser(quickUser)
          setAppUser(readCachedAppUser(quickUser) || getFallbackUser(quickUser))
        }
      } catch (error) {
        console.warn("Fast auth session check did not complete", error)
      }

      try {
        const {
          data: { user },
        } = await withTimeout(supabase.auth.getUser(), "Supabase auth")
        setSupabaseUser(user)

        if (user) {
          await fetchAppUser(user)
          redirectToStoredAuthReturn()
        } else {
          setAppUser(null)
        }
      } catch (error) {
        console.error("Failed to initialize auth state", error)
        if (!quickUser) {
          setSupabaseUser(null)
          setAppUser(null)
        }
      } finally {
        setIsLoading(false)
      }
    }

    getSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null
      setSupabaseUser(user)

      if (user) {
        setAppUser(readCachedAppUser(user) || getFallbackUser(user))
        setIsAuthModalOpen(false)
        await fetchAppUser(user)
        redirectToStoredAuthReturn()
      } else {
        setAppUser(null)
      }
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  const logout = async () => {
    await supabase.auth.signOut()
    setSupabaseUser(null)
    setAppUser(null)
    writeCachedAppUser(null)
    window.location.href = "/"
  }

  const openAuthModal = (redirectPath?: string) => {
    setAuthRedirectPath(redirectPath || null)
    setIsAuthModalOpen(true)
  }
  const closeAuthModal = () => {
    setIsAuthModalOpen(false)
    setAuthRedirectPath(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user: appUser,
        supabaseUser,
        isLoading,
        isAuthenticated: !!supabaseUser,
        logout,
        isAuthModalOpen,
        authRedirectPath,
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
