import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { getDefaultRole, isFullAdminRole } from "@/lib/permissions"
import {
  ensureLocalUserFromSupabaseAuthUser,
  getSupabaseAuthUserEmail,
  getSupabaseAuthUserImage,
  getSupabaseAuthUserName,
  getSupabaseAuthUserProvider,
  listSupabaseAuthUsers,
} from "@/lib/auth-user-sync"
import type { User as SupabaseAuthUser } from "@supabase/supabase-js"

type AdminSession = Awaited<ReturnType<typeof auth>>

function emptyCounts() {
  return {
    orders: 0,
    classBookings: 0,
    residencyApps: 0,
  }
}

function authOnlyUser(authUser: SupabaseAuthUser) {
  const email = getSupabaseAuthUserEmail(authUser) || authUser.email || ""

  return {
    id: `auth:${authUser.id}`,
    name: getSupabaseAuthUserName(authUser),
    email,
    role: getDefaultRole(email),
    image: getSupabaseAuthUserImage(authUser),
    createdAt: authUser.created_at || new Date().toISOString(),
    hasLocalUser: false,
    hasSupabaseAuth: true,
    authCreatedAt: authUser.created_at || null,
    lastSignInAt: authUser.last_sign_in_at || null,
    authProvider: getSupabaseAuthUserProvider(authUser),
    _count: emptyCounts(),
  }
}

async function getFallbackSession(): Promise<AdminSession> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) return null

  return {
    user: {
      id: user.id,
      email: user.email,
      name: getSupabaseAuthUserName(user),
      image: getSupabaseAuthUserImage(user),
      role: getDefaultRole(user.email),
    },
  }
}

export async function GET() {
  let session: AdminSession
  let authError: string | null = null

  try {
    session = await auth()
  } catch (error) {
    console.error("Could not verify admin user list access", error)
    authError = "Local user lookup failed. Showing auth-only records where possible."
    session = await getFallbackSession()
  }

  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const authUsersResult = await listSupabaseAuthUsers()
  const authUsersByEmail = new Map(
    authUsersResult.users.flatMap((authUser) => {
      const email = getSupabaseAuthUserEmail(authUser)
      return email ? [[email, authUser] as const] : []
    })
  )
  let createdFromAuth = 0
  let databaseError: string | null = null

  try {
    if (authUsersResult.users.length > 0) {
      const localUsers = await prisma.user.findMany({
        select: { email: true },
      })
      const localEmails = new Set(localUsers.map((user) => user.email.trim().toLowerCase()))

      for (const authUser of authUsersResult.users) {
        const email = getSupabaseAuthUserEmail(authUser)
        if (!email || localEmails.has(email)) continue

        try {
          const syncedUser = await ensureLocalUserFromSupabaseAuthUser(authUser)
          if (syncedUser) {
            localEmails.add(email)
            createdFromAuth += 1
          }
        } catch (syncError) {
          console.error("Failed to backfill Supabase Auth user", { email, error: syncError })
        }
      }
    }
  } catch (error) {
    databaseError = "Could not sync auth users into the local database. Role changes may be unavailable."
    console.error("Could not sync Supabase Auth users into local users", error)
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            classBookings: true,
            residencyApps: true,
          },
        },
      },
    })
    const canVerifyAuthUsers = authUsersResult.enabled && !authUsersResult.error

    return NextResponse.json({
      users: users.map((user) => {
        const authUser = authUsersByEmail.get(user.email.trim().toLowerCase())

        return {
          ...user,
          hasLocalUser: true,
          hasSupabaseAuth: canVerifyAuthUsers ? Boolean(authUser) : undefined,
          authCreatedAt: authUser?.created_at || null,
          lastSignInAt: authUser?.last_sign_in_at || null,
          authProvider: authUser ? getSupabaseAuthUserProvider(authUser) : null,
        }
      }),
      authSync: {
        enabled: authUsersResult.enabled,
        error: [authError, databaseError, authUsersResult.error].filter(Boolean).join(" ") || null,
        authUserCount: authUsersResult.users.length,
        createdFromAuth,
      },
    })
  } catch (error) {
    console.error("Could not load admin users", error)
    databaseError = "Database communication failed. Showing Supabase Auth records only."
  }

  if (authUsersResult.users.length > 0) {
    return NextResponse.json({
      users: authUsersResult.users.map(authOnlyUser),
      authSync: {
        enabled: authUsersResult.enabled,
        error: [authError, databaseError, authUsersResult.error].filter(Boolean).join(" ") || null,
        authUserCount: authUsersResult.users.length,
        createdFromAuth,
      },
    })
  }

  return NextResponse.json({
    users: [{
      id: `auth:${session.user.id}`,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      image: session.user.image,
      createdAt: new Date().toISOString(),
      hasLocalUser: false,
      hasSupabaseAuth: true,
      authCreatedAt: null,
      lastSignInAt: null,
      authProvider: null,
      _count: emptyCounts(),
    }],
    authSync: {
      enabled: authUsersResult.enabled,
      error: [authError, databaseError, authUsersResult.error, "Only your current auth session could be shown."].filter(Boolean).join(" "),
      authUserCount: authUsersResult.users.length,
      createdFromAuth,
    },
  })
}
