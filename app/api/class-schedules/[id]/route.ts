import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"

const scheduleStatuses = ["ACTIVE", "PAUSED", "CANCELLED"] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await req.json()
  if (!scheduleStatuses.includes(data.status)) {
    return NextResponse.json({ error: "Invalid schedule status" }, { status: 400 })
  }

  const schedule = await prisma.classSchedule.update({
    where: { id },
    data: {
      status: data.status,
    },
  })

  return NextResponse.json(schedule)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await prisma.classSchedule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
