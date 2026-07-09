import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  ""

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    ...(supabaseUrl ? { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl } : {}),
    ...(supabaseAnonKey ? { NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey } : {}),
  },
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: __dirname,
  experimental: {
    turbopackLocalPostcssConfig: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
