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

export const roleAccessDescriptions: Record<AppRole, string> = {
  USER: "Customer account access only: bookings, checkout, profile, and order history. No admin or POS access.",
  POS_OPERATOR: "Cashier access: use the POS, add POS products and drafts, and receive sales and class booking notifications.",
  MANAGER: "Daily operations access: add and edit products, use the POS, manage bookings/orders, view analytics, and receive sales and class booking notifications. Cannot change user roles.",
  ADMIN: "Full admin operations access: products, POS, bookings, orders, applications, analytics, settings, and notifications. Cannot change the owner role.",
  OWNER: "Owner access: all admin and POS tools, notifications, settings, and user role management.",
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

export function canViewAnalytics(role?: string | null) {
  const normalized = normalizeRole(role)
  return normalized === "OWNER" || normalized === "ADMIN" || normalized === "MANAGER"
}
