import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isFullAdminRole(session.user.role)) {
    const bookings = await prisma.classBooking.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(bookings)
  }

  const bookings = await prisma.classBooking.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        ...(session.user.email ? [{ contactEmail: session.user.email }] : []),
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
