import webPush, { type PushSubscription as WebPushSubscription } from "web-push"
import { prisma } from "@/lib/prisma"
import { normalizeRole, type AppRole } from "@/lib/permissions"

type PushPreferenceKey = "classBookingNotifications" | "salesNotifications" | "websiteVisitNotifications"

type PushPayload = {
  type: string
  title: string
  message: string
  path?: string | null
  notificationId?: string
}

type StoredPushSubscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

const publicVapidKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || ""
const privateVapidKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() || ""
const vapidSubject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || "mailto:backusceramics@gmail.com"

let configured = false

export function getWebPushPublicKey() {
  return publicVapidKey
}

export function isWebPushConfigured() {
  return Boolean(publicVapidKey && privateVapidKey)
}

function configureWebPush() {
  if (configured || !isWebPushConfigured()) return
  webPush.setVapidDetails(vapidSubject, publicVapidKey, privateVapidKey)
  configured = true
}

function preferenceForNotificationType(type: string): PushPreferenceKey | null {
  if (type === "CLASS_BOOKED") return "classBookingNotifications"
  if (type === "CUP_SOLD" || type === "POS_SALE_PAID") return "salesNotifications"
  if (type === "WEBSITE_VISIT") return "websiteVisitNotifications"
  return null
}

function rolesForNotificationType(type: string): AppRole[] {
  if (type === "CLASS_BOOKED" || type === "CUP_SOLD" || type === "POS_SALE_PAID") {
    return ["OWNER", "ADMIN", "MANAGER", "POS_OPERATOR"]
  }

  if (type === "WEBSITE_VISIT") {
    return ["OWNER", "ADMIN", "MANAGER"]
  }

  return ["OWNER", "ADMIN", "MANAGER", "POS_OPERATOR"]
}

function toWebPushSubscription(subscription: StoredPushSubscription): WebPushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  }
}

function siteUrlForPath(path?: string | null) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "https://www.backusceramics.com"
  if (!path) return baseUrl
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`
}

export async function sendPushForAdminNotification(payload: PushPayload) {
  const preferenceKey = preferenceForNotificationType(payload.type)
  if (!preferenceKey || !isWebPushConfigured()) return

  configureWebPush()

  const allowedRoles = rolesForNotificationType(payload.type)
  const users = await prisma.user.findMany({
    where: {
      role: { in: allowedRoles },
      notificationPreference: {
        browserPushEnabled: true,
        [preferenceKey]: true,
      },
      pushSubscriptions: {
        some: { enabled: true },
      },
    },
    include: {
      pushSubscriptions: {
        where: { enabled: true },
        select: {
          id: true,
          endpoint: true,
          p256dh: true,
          auth: true,
        },
      },
    },
  })

  const notificationBody = JSON.stringify({
    title: payload.title,
    body: payload.message,
    url: siteUrlForPath(payload.path),
    tag: payload.notificationId || payload.type,
    data: {
      notificationId: payload.notificationId || null,
      type: payload.type,
      path: payload.path || null,
      url: siteUrlForPath(payload.path),
    },
  })

  await Promise.all(
    users
      .filter((user) => allowedRoles.includes(normalizeRole(user.role)))
      .flatMap((user) => user.pushSubscriptions)
      .map(async (subscription) => {
        try {
          await webPush.sendNotification(toWebPushSubscription(subscription), notificationBody)
        } catch (error) {
          const statusCode = typeof error === "object" && error && "statusCode" in error
            ? Number((error as { statusCode?: unknown }).statusCode)
            : null

          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.update({
              where: { id: subscription.id },
              data: { enabled: false },
            })
            return
          }

          console.error("Could not send browser push notification", {
            subscriptionId: subscription.id,
            type: payload.type,
            error,
          })
        }
      })
  )
}
