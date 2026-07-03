import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { recordAnalyticsEvent } from "@/lib/analytics-server"

export const runtime = "nodejs"

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
  let data: ClientAnalyticsPayload = {}
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid analytics payload" }, { status: 400 })
  }

  if (!data.type) {
    return NextResponse.json({ error: "Missing analytics event type" }, { status: 400 })
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
