import { createBrowserClient } from "@supabase/ssr"

function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    if (typeof window === "undefined") {
      return { url: "https://supabase.invalid", anonKey: "missing-build-time-supabase-key" }
    }

    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.")
  }

  return { url, anonKey }
}

export function createClient() {
  const { url, anonKey } = getSupabaseBrowserConfig()

  return createBrowserClient(
    url,
    anonKey
  )
}
