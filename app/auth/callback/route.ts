import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/account"

  // Dynamically resolve correct public origin using headers to prevent localhost redirect
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "backusceramics.com"
  const proto = request.headers.get("x-forwarded-proto") || "https"
  // Clean proto in case of multiple values (e.g. "https, http")
  const cleanProto = proto.split(",")[0].trim()
  const origin = `${cleanProto}://${host}`

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Successful auth — redirect to the intended destination
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth error — redirect back to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
