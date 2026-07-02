import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"

const applicationStatuses = ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "WAITLISTED", "DECLINED", "CANCELLED"] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { status } = await req.json()
  if (!applicationStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid application status" }, { status: 400 })
  }

  const application = await prisma.residencyApplication.update({
    where: { id },
    data: { status },
  })

  return NextResponse.json(application)
}
