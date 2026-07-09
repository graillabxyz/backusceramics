import { createHash } from "crypto"

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

export function hashIpAddress(value: unknown) {
  const ip = cleanString(value, 120)
  if (!ip) return null

  const salt = process.env.ANALYTICS_IP_HASH_SALT || process.env.NEXT_PUBLIC_SITE_URL || "backus-analytics"
  return `sha256:${createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32)}`
}
