import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

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
  } = await supabase.auth.getUser()

  if (!user) return null

  // Look up the user in our Prisma database to get their role
  let dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
  })

  // Auto-create the user in our DB if they don't exist yet (first Google sign-in)
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        email: user.email!,
        name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        image: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        role: "USER",
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
}
