import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { appRoles, canManageAdmins, isOwnerEmail, normalizeRole } from "@/lib/permissions"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session || !canManageAdmins(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { role } = await req.json()
  if (!appRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { email: true },
  })

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (isOwnerEmail(targetUser.email) && normalizeRole(role) !== "OWNER") {
    return NextResponse.json({ error: "The owner admin must keep the owner role" }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role: normalizeRole(role) },
  })

  return NextResponse.json(user)
}
