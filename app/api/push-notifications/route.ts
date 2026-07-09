import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getWebPushPublicKey, isWebPushConfigured } from "@/lib/push-notifications"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"

export const runtime = "nodejs"
const MAX_PUSH_BODY_BYTES = 16 * 1024

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

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
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

  if (isRequestBodyTooLarge(req, MAX_PUSH_BODY_BYTES)) {
    return NextResponse.json({ error: "Notification settings payload is too large" }, { status: 413 })
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

  if (isRequestBodyTooLarge(req, MAX_PUSH_BODY_BYTES)) {
    return NextResponse.json({ error: "Push subscription is too large" }, { status: 413 })
  }

  const data = await req.json().catch(() => ({}))
  const subscription = data.subscription
  const endpoint = typeof subscription?.endpoint === "string" ? cleanString(subscription.endpoint, 2000) : ""
  const p256dh = typeof subscription?.keys?.p256dh === "string" ? cleanString(subscription.keys.p256dh, 512) : ""
  const authKey = typeof subscription?.keys?.auth === "string" ? cleanString(subscription.keys.auth, 512) : ""

  if (!endpoint || !isHttpsUrl(endpoint) || !p256dh || !authKey) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 })
  }

  const userAgent = cleanString(req.headers.get("user-agent"), 500) || null

  const [savedSubscription, preference] = await prisma.$transaction([
    prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: user.id,
        p256dh,
        auth: authKey,
        userAgent,
        enabled: true,
      },
      create: {
        userId: user.id,
        endpoint,
        p256dh,
        auth: authKey,
        userAgent,
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

  if (isRequestBodyTooLarge(req, MAX_PUSH_BODY_BYTES)) {
    return NextResponse.json({ error: "Push request is too large" }, { status: 413 })
  }

  const data = await req.json().catch(() => ({}))
  const endpoint = typeof data.endpoint === "string" ? cleanString(data.endpoint, 2000) : ""

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
