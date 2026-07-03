import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { getDefaultRole } from "@/lib/permissions"
import type { User as SupabaseUser } from "@supabase/supabase-js"

function getSupabaseUserName(user: SupabaseUser) {
  return user.user_metadata?.full_name || user.user_metadata?.name || null
}

function getSupabaseUserImage(user: SupabaseUser) {
  return user.user_metadata?.avatar_url || user.user_metadata?.picture || null
}

function createFallbackSession(user: SupabaseUser) {
  return {
    user: {
      id: user.id,
      email: user.email!,
      name: getSupabaseUserName(user),
      image: getSupabaseUserImage(user),
      role: getDefaultRole(user.email),
    },
  }
}

/**
 * Server-side auth helper — returns a session-like object compatible with
 * the interface all existing API routes expect:
 *   const session = await auth()
 *   session?.user?.email / session?.user?.role / session?.user?.id
 */
export async function auth() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    console.error("Failed to read Supabase auth user", error)
    return null
  }

  if (!user?.email) return null

  const defaultRole = getDefaultRole(user.email)
  const fallbackSession = createFallbackSession(user)

  try {
    // Look up the user in our Prisma database to get their role. Database
    // failures should not make a valid Supabase session look signed out.
    let dbUser = await prisma.user.findUnique({
      where: { email: user.email },
    })

    if (dbUser && defaultRole === "OWNER" && dbUser.role !== "OWNER") {
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: { role: "OWNER" },
      })
    }

    // Auto-create the user in our DB if they don't exist yet (first Google sign-in)
    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          email: user.email,
          name: getSupabaseUserName(user),
          image: getSupabaseUserImage(user),
          role: defaultRole,
        },
      })
    }

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        image: dbUser.image,
        role: dbUser.role,
      },
    }
  } catch (error) {
    console.error("Database user lookup failed; using Supabase auth session", error)
    return fallbackSession
  }
}
