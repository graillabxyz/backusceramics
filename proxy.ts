import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])
const CROSS_ORIGIN_API_PATHS = new Set(["/api/payments/xendit-webhook"])

function requestHost(request: NextRequest) {
  return (request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host)
    .split(",")[0]
    .trim()
    .toLowerCase()
}

function configuredSiteHost() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!configuredUrl) return null

  try {
    return new URL(configuredUrl).host.toLowerCase()
  } catch {
    return null
  }
}

function isAllowedBrowserOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")
  const fetchSite = request.headers.get("sec-fetch-site")

  if (!origin) return fetchSite !== "cross-site"

  try {
    const originHost = new URL(origin).host.toLowerCase()
    return originHost === requestHost(request) || originHost === configuredSiteHost()
  } catch {
    return false
  }
}

function getSupabaseMiddlewareConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.")
  }

  return { url, anonKey }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/api/") &&
    MUTATING_METHODS.has(request.method) &&
    !CROSS_ORIGIN_API_PATHS.has(pathname) &&
    !isAllowedBrowserOrigin(request)
  ) {
    return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 })
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const { url, anonKey } = getSupabaseMiddlewareConfig()
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — IMPORTANT: must call getUser() to refresh the session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes — require auth
  if (pathname.startsWith("/admin") || pathname.startsWith("/account")) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`)
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/account/:path*",
    "/api/:path*",
    // Also match auth callback to ensure cookies are set properly
    "/auth/callback",
  ],
}
