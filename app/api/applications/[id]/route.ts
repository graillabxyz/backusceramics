import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"
import { isRequestBodyTooLarge } from "@/lib/server-security"

const applicationStatuses = ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "WAITLISTED", "DECLINED", "CANCELLED"] as const
const MAX_APPLICATION_STATUS_BODY_BYTES = 8 * 1024

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isRequestBodyTooLarge(req, MAX_APPLICATION_STATUS_BODY_BYTES)) return NextResponse.json({ error: "Application update is too large" }, { status: 413 })
  const { status } = await req.json().catch(() => ({}))
  if (!applicationStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid application status" }, { status: 400 })
  }

  const existing = await prisma.residencyApplication.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  const application = await prisma.residencyApplication.update({
    where: { id },
    data: { status },
  })

  return NextResponse.json(application)
}
