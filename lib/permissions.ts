export const OWNER_ADMIN_EMAIL = "backusceramics@gmail.com"

export const appRoles = ["USER", "ADMIN", "OWNER", "POS_OPERATOR"] as const

export type AppRole = (typeof appRoles)[number]

export const roleLabels: Record<AppRole, string> = {
  USER: "User",
  ADMIN: "Admin",
  OWNER: "Owner admin",
  POS_OPERATOR: "Point of sale",
}

export function normalizeRole(role?: string | null): AppRole {
  return appRoles.includes(role as AppRole) ? (role as AppRole) : "USER"
}

export function getDefaultRole(email?: string | null): AppRole {
  return email?.toLowerCase() === OWNER_ADMIN_EMAIL ? "OWNER" : "USER"
}

export function isOwnerEmail(email?: string | null) {
  return email?.toLowerCase() === OWNER_ADMIN_EMAIL
}

export function isOwnerRole(role?: string | null) {
  return normalizeRole(role) === "OWNER"
}

export function isFullAdminRole(role?: string | null) {
  const normalized = normalizeRole(role)
  return normalized === "OWNER" || normalized === "ADMIN"
}

export function canAccessAdmin(role?: string | null) {
  const normalized = normalizeRole(role)
  return normalized === "OWNER" || normalized === "ADMIN" || normalized === "POS_OPERATOR"
}

export function canManageAdmins(role?: string | null) {
  return isOwnerRole(role)
}

export function canUsePos(role?: string | null) {
  return canAccessAdmin(role)
}
