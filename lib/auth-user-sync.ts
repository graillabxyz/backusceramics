import { createClient, type User as SupabaseAuthUser } from "@supabase/supabase-js"
import { prisma } from "@/lib/prisma"
import { getDefaultRole } from "@/lib/permissions"

export interface SupabaseAuthUsersResult {
  enabled: boolean
  users: SupabaseAuthUser[]
  error?: string | null
}

function getSupabaseAdminConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) return null

  return { url, serviceRoleKey }
}

export function getSupabaseAuthUserEmail(user: SupabaseAuthUser) {
  return user.email?.trim().toLowerCase() || null
}

export function getSupabaseAuthUserName(user: SupabaseAuthUser) {
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    getSupabaseAuthUserEmail(user)?.split("@")[0] ||
    null
  )
}

export function getSupabaseAuthUserImage(user: SupabaseAuthUser) {
  return user.user_metadata?.avatar_url || user.user_metadata?.picture || null
}

export function getSupabaseAuthUserProvider(user: SupabaseAuthUser) {
  const providers = user.app_metadata?.providers
  if (Array.isArray(providers) && providers.length > 0) return String(providers[0])
  return user.app_metadata?.provider ? String(user.app_metadata.provider) : null
}

export async function ensureLocalUserFromSupabaseAuthUser(user: SupabaseAuthUser) {
  const email = getSupabaseAuthUserEmail(user)
  if (!email) return null

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    const nextName = existing.name || getSupabaseAuthUserName(user)
    const nextImage = existing.image || getSupabaseAuthUserImage(user)
    const nextRole = getDefaultRole(email) === "OWNER" && existing.role !== "OWNER" ? "OWNER" : existing.role

    if (nextName !== existing.name || nextImage !== existing.image || nextRole !== existing.role) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          name: nextName,
          image: nextImage,
          role: nextRole,
        },
      })
    }

    return existing
  }

  return prisma.user.create({
    data: {
      email,
      name: getSupabaseAuthUserName(user),
      image: getSupabaseAuthUserImage(user),
      role: getDefaultRole(email),
      createdAt: user.created_at ? new Date(user.created_at) : undefined,
    },
  })
}

export async function listSupabaseAuthUsers(): Promise<SupabaseAuthUsersResult> {
  const config = getSupabaseAdminConfig()
  if (!config) {
    return {
      enabled: false,
      users: [],
      error: "SUPABASE_SERVICE_ROLE_KEY is not configured.",
    }
  }

  const supabase = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false },
  })

  const users: SupabaseAuthUser[] = []
  const perPage = 1000
  let page = 1

  try {
    while (page < 1000) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
      if (error) throw error

      users.push(...(data.users || []))
      if (!data.users || data.users.length < perPage) break

      page += 1
    }

    return { enabled: true, users }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Supabase Auth listUsers error"
    return { enabled: true, users, error: message }
  }
}
