"use client"

export interface ClientAnalyticsEvent {
  type: string
  path?: string | null
  pageTitle?: string | null
  referrer?: string | null
  productId?: string | null
  productSlug?: string | null
  productName?: string | null
  productCategory?: string | null
  workshopId?: string | null
  workshopTitle?: string | null
  scheduleId?: string | null
  source?: string | null
  value?: number | null
  currency?: string | null
  metadata?: Record<string, unknown>
}

const visitorKey = "backus:analytics:visitor-id"
const sessionKey = "backus:analytics:session-id"
const checkoutPaymentStartedPrefix = "backus:analytics:checkout-payment-started:"

function randomId(prefix: string) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}_${id}`
}

function readOrCreateStorageId(storage: Storage | null, key: string, prefix: string) {
  if (!storage) return randomId(prefix)

  try {
    const existing = storage.getItem(key)
    if (existing) return existing

    const next = randomId(prefix)
    storage.setItem(key, next)
    return next
  } catch {
    return randomId(prefix)
  }
}

function getStorage(kind: "local" | "session") {
  if (typeof window === "undefined") return null
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

function currentPath() {
  if (typeof window === "undefined") return "/"
  return `${window.location.pathname}${window.location.search}`
}

export function getAnalyticsIds() {
  return {
    visitorId: readOrCreateStorageId(getStorage("local"), visitorKey, "visitor"),
    sessionId: readOrCreateStorageId(getStorage("session"), sessionKey, "session"),
  }
}

export function markCheckoutPaymentStarted(path = currentPath()) {
  try {
    window.sessionStorage.setItem(`${checkoutPaymentStartedPrefix}${path}`, String(Date.now()))
  } catch {
    // Best-effort only; analytics should never block checkout.
  }
}

export function hasCheckoutPaymentStarted(path = currentPath()) {
  try {
    return Boolean(window.sessionStorage.getItem(`${checkoutPaymentStartedPrefix}${path}`))
  } catch {
    return false
  }
}

function buildPayload(event: ClientAnalyticsEvent) {
  const ids = getAnalyticsIds()
  const metadata = {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : null,
    ...event.metadata,
  }

  return JSON.stringify({
    ...event,
    path: event.path || currentPath(),
    pageTitle: event.pageTitle || (typeof document !== "undefined" ? document.title : null),
    referrer: event.referrer ?? (typeof document !== "undefined" ? document.referrer || null : null),
    visitorId: ids.visitorId,
    sessionId: ids.sessionId,
    metadata,
  })
}

export function trackAnalyticsEvent(event: ClientAnalyticsEvent, options: { beacon?: boolean } = {}) {
  if (typeof window === "undefined") return Promise.resolve()
  const payload = buildPayload(event)

  if (options.beacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/events", new Blob([payload], { type: "application/json" }))
    return Promise.resolve()
  }

  return fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: options.beacon,
  }).then(() => undefined).catch(() => undefined)
}
