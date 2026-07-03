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
  type SupabaseAuthUsersResult,
} from "@/lib/auth-user-sync"
import type { User as SupabaseAuthUser } from "@supabase/supabase-js"

type AdminSession = Awaited<ReturnType<typeof auth>>

function emptyCounts() {
  return {
    orders: 0,
    classBookings: 0,
    residencyApps: 0,
    posSales: 0,
  }
}

function emptyMetrics() {
  return {
    pageViews: 0,
    productViews: 0,
    checkoutViews: 0,
    checkoutIntentClicks: 0,
    paymentIntentClicks: 0,
    paymentSessionsCreated: 0,
    paymentsCompleted: 0,
    checkoutAbandoned: 0,
    paymentStartFailed: 0,
    totalEvents: 0,
    confirmedClassBookings: 0,
    completedClassBookings: 0,
    pendingClassBookings: 0,
    cancelledClassBookings: 0,
    posReceiptPurchases: 0,
    posReceiptSpend: 0,
    lastActivityAt: null as string | null,
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
    metrics: emptyMetrics(),
    purchaseCount: 0,
  }
}

async function loadUserMetrics(users: Array<{ id: string; email: string }>) {
  const metricsByUserId = new Map(users.map((user) => [user.id, emptyMetrics()]))
  if (users.length === 0) return metricsByUserId

  const userIds = users.map((user) => user.id)
  const emailToUserId = new Map(
    users.map((user) => [user.email.trim().toLowerCase(), user.id])
  )
  const emails = users.map((user) => user.email)

  try {
    const [eventsByType, latestEvents] = await Promise.all([
      prisma.analyticsEvent.groupBy({
        by: ["userId", "type"],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _max: { createdAt: true },
      }),
    ])

    for (const eventGroup of eventsByType) {
      if (!eventGroup.userId) continue
      const metrics = metricsByUserId.get(eventGroup.userId)
      if (!metrics) continue

      const count = eventGroup._count._all
      metrics.totalEvents += count

      switch (eventGroup.type) {
        case "page_view":
          metrics.pageViews += count
          break
        case "product_view":
          metrics.productViews += count
          break
        case "checkout_view":
          metrics.checkoutViews += count
          break
        case "checkout_intent_click":
          metrics.checkoutIntentClicks += count
          break
        case "payment_intent_click":
          metrics.paymentIntentClicks += count
          break
        case "payment_session_created":
          metrics.paymentSessionsCreated += count
          break
        case "payment_completed":
          metrics.paymentsCompleted += count
          break
        case "checkout_abandoned":
          metrics.checkoutAbandoned += count
          break
        case "payment_start_failed":
        case "payment_session_failed":
          metrics.paymentStartFailed += count
          break
      }
    }

    for (const latestEvent of latestEvents) {
      if (!latestEvent.userId) continue
      const metrics = metricsByUserId.get(latestEvent.userId)
      if (!metrics) continue
      metrics.lastActivityAt = latestEvent._max.createdAt?.toISOString() || null
    }
  } catch (error) {
    console.error("Could not load per-user analytics metrics", error)
  }

  try {
    const bookingGroups = await prisma.classBooking.groupBy({
      by: ["userId", "status"],
      where: { userId: { in: userIds } },
      _count: { _all: true },
    })

    for (const bookingGroup of bookingGroups) {
      if (!bookingGroup.userId) continue
      const metrics = metricsByUserId.get(bookingGroup.userId)
      if (!metrics) continue
      const count = bookingGroup._count._all

      switch (bookingGroup.status) {
        case "CONFIRMED":
          metrics.confirmedClassBookings += count
          break
        case "COMPLETED":
          metrics.completedClassBookings += count
          break
        case "CANCELLED":
          metrics.cancelledClassBookings += count
          break
        default:
          metrics.pendingClassBookings += count
          break
      }
    }
  } catch (error) {
    console.error("Could not load per-user class booking metrics", error)
  }

  try {
    const posSaleGroups = await prisma.posSale.groupBy({
      by: ["receiptEmail", "status"],
      where: {
        receiptEmail: { in: emails },
      },
      _count: { _all: true },
      _sum: { total: true },
    })

    for (const saleGroup of posSaleGroups) {
      if (!saleGroup.receiptEmail || saleGroup.status !== "PAID") continue
      const userId = emailToUserId.get(saleGroup.receiptEmail.trim().toLowerCase())
      if (!userId) continue
      const metrics = metricsByUserId.get(userId)
      if (!metrics) continue

      metrics.posReceiptPurchases += saleGroup._count._all
      metrics.posReceiptSpend += saleGroup._sum.total || 0
    }
  } catch (error) {
    console.error("Could not load per-user POS receipt metrics", error)
  }

  return metricsByUserId
}

async function getFallbackSession(): Promise<AdminSession> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      console.error("Could not read fallback Supabase user for admin users list", error)
      return null
    }

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
  } catch (error) {
    console.error("Could not create fallback Supabase session for admin users list", error)
    return null
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

  let authUsersResult: SupabaseAuthUsersResult = {
    enabled: false,
    users: [],
    error: null,
  }

  try {
    authUsersResult = await listSupabaseAuthUsers()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Supabase Auth listUsers error"
    console.error("Could not list Supabase Auth users", error)
    authUsersResult = {
      enabled: true,
      users: [],
      error: message,
    }
  }
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
            posSales: true,
          },
        },
      },
    })
    const metricsByUserId = await loadUserMetrics(users)
    const canVerifyAuthUsers = authUsersResult.enabled && !authUsersResult.error

    return NextResponse.json({
      users: users.map((user) => {
        const authUser = authUsersByEmail.get(user.email.trim().toLowerCase())
        const metrics = metricsByUserId.get(user.id) || emptyMetrics()

        return {
          ...user,
          hasLocalUser: true,
          hasSupabaseAuth: canVerifyAuthUsers ? Boolean(authUser) : undefined,
          authCreatedAt: authUser?.created_at || null,
          lastSignInAt: authUser?.last_sign_in_at || null,
          authProvider: authUser ? getSupabaseAuthUserProvider(authUser) : null,
          metrics,
          purchaseCount:
            user._count.orders +
            metrics.confirmedClassBookings +
            metrics.completedClassBookings +
            metrics.posReceiptPurchases,
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
      metrics: emptyMetrics(),
      purchaseCount: 0,
    }],
    authSync: {
      enabled: authUsersResult.enabled,
      error: [authError, databaseError, authUsersResult.error, "Only your current auth session could be shown."].filter(Boolean).join(" "),
      authUserCount: authUsersResult.users.length,
      createdFromAuth,
    },
  })
}
