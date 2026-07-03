import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { appRoles, canManageAdmins, isOwnerEmail, normalizeRole } from "@/lib/permissions"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let session

  try {
    session = await auth()
  } catch (error) {
    console.error("Could not verify role update access", error)
    return NextResponse.json({ error: "Could not verify your admin session" }, { status: 503 })
  }

  if (!session || !canManageAdmins(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { role } = await req.json().catch(() => ({}))
  if (!appRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  if (id.startsWith("auth:")) {
    return NextResponse.json(
      { error: "This auth user has not been backfilled into the local database yet" },
      { status: 409 }
    )
  }

  let targetUser

  try {
    targetUser = await prisma.user.findUnique({
      where: { id },
      select: { email: true },
    })
  } catch (error) {
    console.error("Could not load target user for role update", error)
    return NextResponse.json({ error: "Database is unavailable" }, { status: 503 })
  }

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (isOwnerEmail(targetUser.email) && normalizeRole(role) !== "OWNER") {
    return NextResponse.json({ error: "The owner admin must keep the owner role" }, { status: 400 })
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { role: normalizeRole(role) },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("Could not update user role", error)
    return NextResponse.json({ error: "Could not update user role" }, { status: 503 })
  }
}
