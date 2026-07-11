import { createHash } from "crypto"

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
}

const RATE_LIMIT_STORE_MAX_ENTRIES = 5000
const rateLimitStore = new Map<string, RateLimitEntry>()

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

export function isRequestBodyTooLarge(req: Request, maxBytes: number) {
  const contentLength = req.headers.get("content-length")
  if (!contentLength) return false

  const size = Number(contentLength)
  return Number.isFinite(size) && size > maxBytes
}

export function cleanString(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return ""
  return String(value).replace(/\0/g, "").trim().slice(0, maxLength)
}

export function escapeHtml(value: unknown, maxLength = 1000) {
  return cleanString(value, maxLength).replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char)
}

export function safeEmailSubject(value: unknown, fallback: string, maxLength = 120) {
  const cleaned = cleanString(value, maxLength).replace(/[\r\n]+/g, " ")
  return cleaned || fallback
}

export function safeHeaderValue(value: unknown, maxLength = 254) {
  return cleanString(value, maxLength).replace(/[\r\n]+/g, " ")
}

export function isValidEmailAddress(value: unknown) {
  const email = safeHeaderValue(value, 254)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function getRequestIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return (
    forwarded ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-client-ip") ||
    "unknown"
  )
}

function pruneRateLimitStore(now: number) {
  if (rateLimitStore.size < RATE_LIMIT_STORE_MAX_ENTRIES) return

  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) rateLimitStore.delete(key)
  }

  if (rateLimitStore.size < RATE_LIMIT_STORE_MAX_ENTRIES) return

  const oldestKeys = Array.from(rateLimitStore.entries())
    .sort((left, right) => left[1].resetAt - right[1].resetAt)
    .slice(0, Math.ceil(RATE_LIMIT_STORE_MAX_ENTRIES * 0.1))
    .map(([key]) => key)
  oldestKeys.forEach((key) => rateLimitStore.delete(key))
}

/**
 * A lightweight burst limiter for Vercel functions. This protects each warm
 * instance immediately; platform-level rate limiting should remain the outer
 * layer for distributed attacks.
 */
export function checkRateLimit(req: Request, options: RateLimitOptions) {
  const now = Date.now()
  pruneRateLimitStore(now)

  const clientKey = `${options.key}:${getRequestIp(req)}`
  const current = rateLimitStore.get(clientKey)
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + options.windowMs }
    : current

  entry.count += 1
  rateLimitStore.set(clientKey, entry)

  return {
    allowed: entry.count <= options.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    remaining: Math.max(0, options.limit - entry.count),
  }
}

export function rateLimitHeaders(retryAfterSeconds: number) {
  return {
    "Retry-After": String(retryAfterSeconds),
    "Cache-Control": "no-store",
  }
}

export function hashIpAddress(value: unknown) {
  const ip = cleanString(value, 120)
  if (!ip) return null

  const salt = process.env.ANALYTICS_IP_HASH_SALT || process.env.NEXT_PUBLIC_SITE_URL || "backus-analytics"
  return `sha256:${createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32)}`
}
