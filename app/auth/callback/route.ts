import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { AUTH_RETURN_TO_COOKIE, sanitizeAuthReturnTo } from "@/lib/auth-redirect"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const requestedNext = searchParams.get("next")
  const cookieNextValue = request.cookies.get(AUTH_RETURN_TO_COOKIE)?.value
  let cookieNext: string | null = null
  if (cookieNextValue) {
    try {
      cookieNext = decodeURIComponent(cookieNextValue)
    } catch {
      cookieNext = cookieNextValue
    }
  }
  const next = sanitizeAuthReturnTo(requestedNext || cookieNext, "/account")

  // Dynamically resolve correct public origin using headers to prevent localhost redirect
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "backusceramics.com"
  const proto = request.headers.get("x-forwarded-proto") || "https"
  const cleanProto = proto.split(",")[0].trim()
  const origin = `${cleanProto}://${host}`

  if (code) {
    // Create the redirect response object first so we can attach cookies directly to it
    const supabaseResponse = NextResponse.redirect(`${origin}${next}`)
    supabaseResponse.cookies.delete(AUTH_RETURN_TO_COOKIE)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
      {
        cookies: {
          getAll() {
            return request.cookies.getAll().map((cookie) => ({
              name: cookie.name,
              value: cookie.value,
            }))
          },
          setAll(cookiesToSet) {
            // Write cookies directly to the redirect response headers
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              supabaseResponse.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return supabaseResponse
    }
  }

  // Auth error — redirect back to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
