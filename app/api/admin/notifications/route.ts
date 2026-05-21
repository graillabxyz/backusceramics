import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"

export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.adminNotification.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
    }),
    prisma.adminNotification.count({ where: { readAt: null } }),
  ])

  return NextResponse.json({ notifications, unreadCount })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await req.json().catch(() => ({}))
  const ids = Array.isArray(data.ids) ? data.ids.filter((id: unknown): id is string => typeof id === "string") : []
  const now = new Date()

  if (data.all === true) {
    await prisma.adminNotification.updateMany({
      where: { readAt: null },
      data: { readAt: now },
    })
  } else if (ids.length > 0) {
    await prisma.adminNotification.updateMany({
      where: { id: { in: ids } },
      data: { readAt: now },
    })
  }

  return NextResponse.json({ ok: true })
}
