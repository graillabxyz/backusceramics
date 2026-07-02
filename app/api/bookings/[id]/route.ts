import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"

const bookingStatuses = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const

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
  if (!bookingStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid booking status" }, { status: 400 })
  }

  const statusDates =
    status === "CONFIRMED"
      ? { confirmedAt: new Date(), holdExpiresAt: null }
      : status === "CANCELLED"
        ? { cancelledAt: new Date(), holdExpiresAt: null }
        : {}

  const booking = await prisma.classBooking.update({
    where: { id },
    data: { status, ...statusDates },
  })

  return NextResponse.json(booking)
}
