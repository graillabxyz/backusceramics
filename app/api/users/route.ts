import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"
import {
  ensureLocalUserFromSupabaseAuthUser,
  getSupabaseAuthUserEmail,
  getSupabaseAuthUserProvider,
  listSupabaseAuthUsers,
} from "@/lib/auth-user-sync"

export async function GET() {
  const session = await auth()
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
        hasSupabaseAuth: canVerifyAuthUsers ? Boolean(authUser) : undefined,
        authCreatedAt: authUser?.created_at || null,
        lastSignInAt: authUser?.last_sign_in_at || null,
        authProvider: authUser ? getSupabaseAuthUserProvider(authUser) : null,
      }
    }),
    authSync: {
      enabled: authUsersResult.enabled,
      error: authUsersResult.error || null,
      authUserCount: authUsersResult.users.length,
      createdFromAuth,
    },
  })
}
