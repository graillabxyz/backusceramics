import type { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashIpAddress } from "@/lib/server-security"

export interface AnalyticsEventInput {
  type: string
  path?: string | null
  referrer?: string | null
  pageTitle?: string | null
  visitorId?: string | null
  sessionId?: string | null
  userId?: string | null
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
  metadata?: Record<string, unknown> | string | null
}

function truncate(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return null
  return String(value).slice(0, maxLength)
}

function header(req: NextRequest | undefined, name: string) {
  if (!req) return null
  const value = req.headers.get(name)
  return value && value !== "null" ? value : null
}

function firstHeader(req: NextRequest | undefined, names: string[]) {
  for (const name of names) {
    const value = header(req, name)
    if (value) return value
  }
  return null
}

function decodeHeaderValue(value: string | null) {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function serializeMetadata(metadata: AnalyticsEventInput["metadata"]) {
  if (!metadata) return null
  if (typeof metadata === "string") return metadata.slice(0, 12000)

  try {
    return JSON.stringify(metadata).slice(0, 12000)
  } catch {
    return null
  }
}

function getIp(req: NextRequest | undefined) {
  return header(req, "x-forwarded-for")?.split(",")[0]?.trim()
    || firstHeader(req, ["cf-connecting-ip", "x-real-ip", "x-client-ip"])
}

function requestGeo(req: NextRequest | undefined) {
  const nextGeo = req && "geo" in req
    ? (req as NextRequest & { geo?: { city?: string; country?: string; region?: string } }).geo
    : undefined

  return {
    city: decodeHeaderValue(firstHeader(req, [
      "x-vercel-ip-city",
      "cloudfront-viewer-city",
      "x-appengine-city",
      "x-geo-city",
    ])) || nextGeo?.city || null,
    region: decodeHeaderValue(firstHeader(req, [
      "x-vercel-ip-country-region",
      "cloudfront-viewer-country-region",
      "x-appengine-region",
      "x-geo-region",
    ])) || nextGeo?.region || null,
    country: decodeHeaderValue(firstHeader(req, [
      "x-vercel-ip-country",
      "cf-ipcountry",
      "cloudfront-viewer-country",
      "x-appengine-country",
      "x-geo-country",
    ])) || nextGeo?.country || null,
  }
}

export async function recordAnalyticsEvent(input: AnalyticsEventInput, req?: NextRequest) {
  const type = truncate(input.type, 80)
  if (!type) return null
  const geo = requestGeo(req)

  try {
    return await prisma.analyticsEvent.create({
      data: {
        type,
        path: truncate(input.path, 500),
        referrer: truncate(input.referrer, 500),
        pageTitle: truncate(input.pageTitle, 300),
        visitorId: truncate(input.visitorId, 120),
        sessionId: truncate(input.sessionId, 120),
        userId: truncate(input.userId, 120),
        productId: truncate(input.productId, 120),
        productSlug: truncate(input.productSlug, 180),
        productName: truncate(input.productName, 240),
        productCategory: truncate(input.productCategory, 120),
        workshopId: truncate(input.workshopId, 120),
        workshopTitle: truncate(input.workshopTitle, 240),
        scheduleId: truncate(input.scheduleId, 120),
        source: truncate(input.source, 120),
        value: Number.isFinite(input.value) ? Math.round(Number(input.value)) : null,
        currency: truncate(input.currency || "IDR", 12) || "IDR",
        metadata: serializeMetadata(input.metadata),
        city: truncate(geo.city, 120),
        region: truncate(geo.region, 120),
        country: truncate(geo.country, 2),
        ip: hashIpAddress(getIp(req)),
        userAgent: truncate(header(req, "user-agent"), 500),
      },
    })
  } catch (error) {
    console.error("Could not record analytics event", { type, error })
    return null
  }
}
