import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getWebPushPublicKey, isWebPushConfigured } from "@/lib/push-notifications"

export const runtime = "nodejs"

type PreferencePatch = {
  browserPushEnabled?: unknown
  classBookingNotifications?: unknown
  salesNotifications?: unknown
  websiteVisitNotifications?: unknown
}

function booleanPatch(data: PreferencePatch) {
  const update: Record<string, boolean> = {}
  for (const key of [
    "browserPushEnabled",
    "classBookingNotifications",
    "salesNotifications",
    "websiteVisitNotifications",
  ] as const) {
    if (typeof data[key] === "boolean") update[key] = data[key]
  }
  return update
}

async function requireUser() {
  const session = await auth()
  return session?.user || null
}

async function getOrCreatePreference(userId: string) {
  return prisma.userNotificationPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
}

export async function GET() {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [preference, subscriptions] = await Promise.all([
    getOrCreatePreference(user.id),
    prisma.pushSubscription.findMany({
      where: { userId: user.id, enabled: true },
      select: { id: true, endpoint: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ])

  return NextResponse.json({
    configured: isWebPushConfigured(),
    publicKey: getWebPushPublicKey(),
    preference,
    subscriptions,
  })
}

export async function PATCH(req: NextRequest) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await req.json().catch(() => ({}))
  const update = booleanPatch(data)

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No notification settings supplied" }, { status: 400 })
  }

  const preference = await prisma.userNotificationPreference.upsert({
    where: { userId: user.id },
    update,
    create: {
      userId: user.id,
      ...update,
    },
  })

  return NextResponse.json({ preference })
}

export async function POST(req: NextRequest) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Push notifications are not configured" }, { status: 503 })
  }

  const data = await req.json().catch(() => ({}))
  const subscription = data.subscription
  const endpoint = typeof subscription?.endpoint === "string" ? subscription.endpoint : ""
  const p256dh = typeof subscription?.keys?.p256dh === "string" ? subscription.keys.p256dh : ""
  const authKey = typeof subscription?.keys?.auth === "string" ? subscription.keys.auth : ""

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 })
  }

  const [savedSubscription, preference] = await prisma.$transaction([
    prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: user.id,
        p256dh,
        auth: authKey,
        userAgent: req.headers.get("user-agent"),
        enabled: true,
      },
      create: {
        userId: user.id,
        endpoint,
        p256dh,
        auth: authKey,
        userAgent: req.headers.get("user-agent"),
      },
    }),
    prisma.userNotificationPreference.upsert({
      where: { userId: user.id },
      update: { browserPushEnabled: true },
      create: { userId: user.id, browserPushEnabled: true },
    }),
  ])

  return NextResponse.json({ subscription: savedSubscription, preference })
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await req.json().catch(() => ({}))
  const endpoint = typeof data.endpoint === "string" ? data.endpoint : ""

  if (endpoint) {
    await prisma.pushSubscription.updateMany({
      where: { userId: user.id, endpoint },
      data: { enabled: false },
    })
  } else {
    await prisma.pushSubscription.updateMany({
      where: { userId: user.id },
      data: { enabled: false },
    })
  }

  const preference = await prisma.userNotificationPreference.upsert({
    where: { userId: user.id },
    update: { browserPushEnabled: false },
    create: { userId: user.id, browserPushEnabled: false },
  })

  return NextResponse.json({ preference })
}
