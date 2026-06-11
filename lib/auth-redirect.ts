export const AUTH_RETURN_TO_COOKIE = "bc_auth_return_to"

const AUTH_RETURN_TO_MAX_AGE_SECONDS = 15 * 60

export function sanitizeAuthReturnTo(value: string | null | undefined, fallback = "/account") {
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback
  if (trimmed.startsWith("/auth/callback")) return fallback
  return trimmed
}

export function setAuthReturnToCookie(value: string | null | undefined) {
  if (typeof document === "undefined") return

  const returnTo = sanitizeAuthReturnTo(value, "/")
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${AUTH_RETURN_TO_COOKIE}=${encodeURIComponent(returnTo)}; Max-Age=${AUTH_RETURN_TO_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
}

export function clearAuthReturnToCookie() {
  if (typeof document === "undefined") return

  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${AUTH_RETURN_TO_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${secure}`
}

export function consumeAuthReturnToCookie(fallback: string | null = null) {
  if (typeof document === "undefined") return fallback

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${AUTH_RETURN_TO_COOKIE}=`))

  if (!cookie) return fallback

  const rawValue = cookie.slice(AUTH_RETURN_TO_COOKIE.length + 1)
  clearAuthReturnToCookie()

  try {
    return sanitizeAuthReturnTo(decodeURIComponent(rawValue), fallback || "/")
  } catch {
    return fallback
  }
}
