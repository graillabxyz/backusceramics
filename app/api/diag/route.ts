import { NextResponse } from "next/server"

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return NextResponse.json({
    hasUrl: !!url,
    urlValue: url ? `${url.substring(0, 15)}...` : null,
    hasKey: !!key,
    keyPrefix: key ? key.substring(0, 15) : null,
    keyLength: key ? key.length : 0,
    isFallbackKey: key === "placeholder-anon-key",
    isFallbackUrl: url === "https://placeholder.supabase.co",
  })
}
