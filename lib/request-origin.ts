import type { NextRequest } from "next/server"

function normalizeOrigin(value?: string | null) {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return null
    }
    return url.origin
  } catch {
    return null
  }
}

export function getTrustedRequestOrigin(request: NextRequest) {
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL)
  if (configured) return configured

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? normalizeOrigin(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    : null
  if (vercelProduction) return vercelProduction

  return normalizeOrigin(request.nextUrl.origin) || "https://www.backusceramics.com"
}
