import { NextRequest, NextResponse } from "next/server"
import { createAdminNotification } from "@/lib/admin-notification-events"
import { checkRateLimit, cleanString, hashIpAddress, isRequestBodyTooLarge, rateLimitHeaders } from "@/lib/server-security"

export const runtime = "nodejs"
const MAX_VISIT_BODY_BYTES = 16 * 1024

function header(req: NextRequest, name: string) {
  const value = req.headers.get(name)
  return value && value !== "null" ? value : null
}

function decodeHeaderValue(value: string | null) {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function locationMessage({ city, region, country }: { city?: string | null; region?: string | null; country?: string | null }) {
  const parts = [city, region, country].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : "Unknown location"
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, { key: "visit-notifications", limit: 30, windowMs: 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many visit events" },
      { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) }
    )
  }

  if (isRequestBodyTooLarge(req, MAX_VISIT_BODY_BYTES)) {
    return NextResponse.json({ error: "Visit payload is too large" }, { status: 413 })
  }

  let data: { path?: string; referrer?: string | null; title?: string | null; timezone?: string | null } = {}
  try {
    data = await req.json()
  } catch {
    data = {}
  }

  const path = typeof data.path === "string" ? cleanString(data.path, 240) : "/"
  if (path.startsWith("/admin")) {
    return NextResponse.json({ ok: true })
  }

  const country = cleanString(decodeHeaderValue(header(req, "x-vercel-ip-country")), 2) || null
  const region = cleanString(decodeHeaderValue(header(req, "x-vercel-ip-country-region")), 120) || null
  const city = cleanString(decodeHeaderValue(header(req, "x-vercel-ip-city")), 120) || null
  const ip = hashIpAddress(header(req, "x-forwarded-for")?.split(",")[0]?.trim() || header(req, "x-real-ip"))
  const userAgent = cleanString(header(req, "user-agent"), 500) || null
  const location = locationMessage({ city, region, country })

  try {
    await createAdminNotification({
      type: "WEBSITE_VISIT",
      title: "Website visitor",
      message: `Someone visited ${path} from ${location}.`,
      path,
      city,
      region,
      country,
      ip,
      userAgent,
      metadata: {
        referrer: cleanString(data.referrer, 500) || null,
        pageTitle: cleanString(data.title, 300) || null,
        timezone: cleanString(data.timezone, 80) || null,
      },
    })
  } catch (error) {
    console.error("Could not create visit notification", error)
  }

  return NextResponse.json({ ok: true })
}
