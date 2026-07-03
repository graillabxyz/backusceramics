const FALLBACK_OWNER_ADMIN_EMAIL = "backusceramics@gmail.com"

export const OWNER_ADMIN_EMAIL = process.env.OWNER_ADMIN_EMAIL || FALLBACK_OWNER_ADMIN_EMAIL

export const appRoles = ["USER", "MANAGER", "ADMIN", "OWNER", "POS_OPERATOR"] as const

export type AppRole = (typeof appRoles)[number]

export const roleLabels: Record<AppRole, string> = {
  USER: "User",
  MANAGER: "Manager",
  ADMIN: "Admin",
  OWNER: "Owner admin",
  POS_OPERATOR: "Point of sale",
}

export function normalizeRole(role?: string | null): AppRole {
  return appRoles.includes(role as AppRole) ? (role as AppRole) : "USER"
}

export function getDefaultRole(email?: string | null): AppRole {
  return isOwnerEmail(email) ? "OWNER" : "USER"
}

export function isOwnerEmail(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail) return false

  const ownerEmails = (process.env.OWNER_ADMIN_EMAILS || OWNER_ADMIN_EMAIL)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  return ownerEmails.includes(normalizedEmail)
}

export function isOwnerRole(role?: string | null) {
  return normalizeRole(role) === "OWNER"
}

export function isFullAdminRole(role?: string | null) {
  const normalized = normalizeRole(role)
  return normalized === "OWNER" || normalized === "ADMIN" || normalized === "MANAGER" || normalized === "POS_OPERATOR"
}

export function canAccessAdmin(role?: string | null) {
  const normalized = normalizeRole(role)
  return normalized === "OWNER" || normalized === "ADMIN" || normalized === "MANAGER" || normalized === "POS_OPERATOR"
}

export function canManageAdmins(role?: string | null) {
  return isOwnerRole(role)
}

export function canUsePos(role?: string | null) {
  return canAccessAdmin(role)
}
