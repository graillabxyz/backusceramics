import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"

const CANCELLED_BOOKING_VISIBLE_DAYS = 5

function cancelledArchiveCutoff() {
  return new Date(Date.now() - CANCELLED_BOOKING_VISIBLE_DAYS * 24 * 60 * 60 * 1000)
}

async function archiveOldCancelledBookings() {
  const cutoff = cancelledArchiveCutoff()
  await prisma.classBooking.updateMany({
    where: {
      status: "CANCELLED",
      OR: [
        { cancelledAt: { lt: cutoff } },
        { cancelledAt: null, updatedAt: { lt: cutoff } },
      ],
    },
    data: {
      status: "ARCHIVED",
      archivedAt: new Date(),
      holdExpiresAt: null,
    },
  })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isFullAdminRole(session.user.role)) {
    await archiveOldCancelledBookings()
    const view = req.nextUrl.searchParams.get("view")
    const bookings = await prisma.classBooking.findMany({
      where: view === "archived"
        ? { status: "ARCHIVED" }
        : { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(bookings)
  }

  const bookings = await prisma.classBooking.findMany({
    where: {
      AND: [
        { status: { not: "ARCHIVED" } },
        {
          OR: [
            { userId: session.user.id },
            ...(session.user.email ? [{ contactEmail: session.user.email }] : []),
          ],
        },
      ],
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(bookings)
}

export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Must be signed in to book" }, { status: 401 })
  }

  return NextResponse.json(
    { error: "Class bookings must be completed through online checkout." },
    { status: 410 }
  )
}
