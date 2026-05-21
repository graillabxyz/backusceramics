import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

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
  let data: { path?: string; referrer?: string | null; title?: string | null; timezone?: string | null } = {}
  try {
    data = await req.json()
  } catch {
    data = {}
  }

  const path = typeof data.path === "string" ? data.path.slice(0, 240) : "/"
  if (path.startsWith("/admin")) {
    return NextResponse.json({ ok: true })
  }

  const country = decodeHeaderValue(header(req, "x-vercel-ip-country"))
  const region = decodeHeaderValue(header(req, "x-vercel-ip-country-region"))
  const city = decodeHeaderValue(header(req, "x-vercel-ip-city"))
  const ip = header(req, "x-forwarded-for")?.split(",")[0]?.trim() || header(req, "x-real-ip")
  const userAgent = header(req, "user-agent")
  const location = locationMessage({ city, region, country })

  try {
    await prisma.adminNotification.create({
      data: {
        type: "WEBSITE_VISIT",
        title: "Website visitor",
        message: `Someone visited ${path} from ${location}.`,
        path,
        city,
        region,
        country,
        ip,
        userAgent,
        metadata: JSON.stringify({
          referrer: data.referrer || null,
          pageTitle: data.title || null,
          timezone: data.timezone || null,
        }),
      },
    })
  } catch (error) {
    console.error("Could not create visit notification", error)
  }

  return NextResponse.json({ ok: true })
}
