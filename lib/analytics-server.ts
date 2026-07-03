import type { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

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
  return header(req, "x-forwarded-for")?.split(",")[0]?.trim() || header(req, "x-real-ip")
}

export async function recordAnalyticsEvent(input: AnalyticsEventInput, req?: NextRequest) {
  const type = truncate(input.type, 80)
  if (!type) return null

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
        city: decodeHeaderValue(header(req, "x-vercel-ip-city")),
        region: decodeHeaderValue(header(req, "x-vercel-ip-country-region")),
        country: decodeHeaderValue(header(req, "x-vercel-ip-country")),
        ip: truncate(getIp(req), 120),
        userAgent: truncate(header(req, "user-agent"), 500),
      },
    })
  } catch (error) {
    console.error("Could not record analytics event", { type, error })
    return null
  }
}
