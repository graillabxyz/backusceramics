import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"

export const runtime = "nodejs"

export async function GET() {
  let session

  try {
    session = await auth()
  } catch (error) {
    console.error("Could not verify notification access", error)
    return NextResponse.json({ notifications: [], unreadCount: 0, error: "Notifications unavailable" })
  }

  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        take: 12,
        orderBy: { createdAt: "desc" },
      }),
      prisma.adminNotification.count({ where: { readAt: null } }),
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error("Could not load admin notifications", error)
    return NextResponse.json({ notifications: [], unreadCount: 0, error: "Notifications unavailable" })
  }
}

export async function PATCH(req: NextRequest) {
  let session

  try {
    session = await auth()
  } catch (error) {
    console.error("Could not verify notification update access", error)
    return NextResponse.json({ ok: false, error: "Notifications unavailable" }, { status: 503 })
  }

  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
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
  } catch (error) {
    console.error("Could not update admin notifications", error)
    return NextResponse.json({ ok: false, error: "Notifications unavailable" }, { status: 503 })
  }
}
