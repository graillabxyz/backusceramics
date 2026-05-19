import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/account"

  // Dynamically resolve correct public origin using headers to prevent localhost redirect
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "backusceramics.com"
  const proto = request.headers.get("x-forwarded-proto") || "https"
  const cleanProto = proto.split(",")[0].trim()
  const origin = `${cleanProto}://${host}`

  if (code) {
    // Create the redirect response object first so we can attach cookies directly to it
    const supabaseResponse = NextResponse.redirect(`${origin}${next}`)

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

