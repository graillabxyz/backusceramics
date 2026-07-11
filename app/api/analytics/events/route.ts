import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { recordAnalyticsEvent } from "@/lib/analytics-server"
import { checkRateLimit, isRequestBodyTooLarge, rateLimitHeaders } from "@/lib/server-security"

export const runtime = "nodejs"
const MAX_ANALYTICS_BODY_BYTES = 32 * 1024
const CLIENT_ANALYTICS_EVENT_TYPES = new Set([
  "page_view",
  "product_view",
  "checkout_view",
  "checkout_abandoned",
  "checkout_intent_click",
  "payment_intent_click",
  "payment_login_required",
  "payment_validation_failed",
  "payment_start_request",
  "payment_start_failed",
  "payment_start_success",
  "payment_checkout_error",
  "payment_return_success",
  "payment_return_cancelled",
  "shop_checkout_payment_click",
  "shop_payment_start_success",
])

type ClientAnalyticsPayload = {
  type?: string
  path?: string | null
  referrer?: string | null
  pageTitle?: string | null
  visitorId?: string | null
  sessionId?: string | null
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
  metadata?: Record<string, unknown> | null
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, { key: "analytics-events", limit: 120, windowMs: 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many analytics requests" },
      { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) }
    )
  }

  if (isRequestBodyTooLarge(req, MAX_ANALYTICS_BODY_BYTES)) {
    return NextResponse.json({ error: "Analytics payload is too large" }, { status: 413 })
  }

  let data: ClientAnalyticsPayload = {}
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid analytics payload" }, { status: 400 })
  }

  if (!data.type || !CLIENT_ANALYTICS_EVENT_TYPES.has(data.type)) {
    return NextResponse.json({ error: "Invalid analytics event type" }, { status: 400 })
  }

  let userId: string | null = null
  try {
    const session = await auth()
    userId = session?.user?.id || null
  } catch {
    userId = null
  }

  await recordAnalyticsEvent({
    type: data.type,
    path: data.path,
    referrer: data.referrer,
    pageTitle: data.pageTitle,
    visitorId: data.visitorId,
    sessionId: data.sessionId,
    userId,
    productId: data.productId,
    productSlug: data.productSlug,
    productName: data.productName,
    productCategory: data.productCategory,
    workshopId: data.workshopId,
    workshopTitle: data.workshopTitle,
    scheduleId: data.scheduleId,
    source: data.source,
    value: data.value,
    currency: data.currency,
    metadata: data.metadata,
  }, req)

  return NextResponse.json({ ok: true })
}
