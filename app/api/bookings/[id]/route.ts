import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"
import { isRequestBodyTooLarge } from "@/lib/server-security"

const bookingStatuses = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "ARCHIVED"] as const
const MAX_BOOKING_STATUS_BODY_BYTES = 8 * 1024

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isRequestBodyTooLarge(req, MAX_BOOKING_STATUS_BODY_BYTES)) return NextResponse.json({ error: "Booking update is too large" }, { status: 413 })
  const { status } = await req.json().catch(() => ({}))
  if (!bookingStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid booking status" }, { status: 400 })
  }

  const now = new Date()
  const statusDates =
    status === "CONFIRMED"
      ? { confirmedAt: now, cancelledAt: null, archivedAt: null, holdExpiresAt: null }
      : status === "CANCELLED"
        ? { cancelledAt: now, archivedAt: null, holdExpiresAt: null }
        : status === "ARCHIVED"
          ? { archivedAt: now, holdExpiresAt: null }
          : { cancelledAt: null, archivedAt: null, holdExpiresAt: null }

  const existing = await prisma.classBooking.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: "Booking not found" }, { status: 404 })

  const booking = await prisma.classBooking.update({
    where: { id },
    data: { status, ...statusDates },
  })

  return NextResponse.json(booking)
}
