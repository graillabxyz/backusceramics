import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role === "ADMIN") {
    const bookings = await prisma.classBooking.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(bookings)
  }

  const bookings = await prisma.classBooking.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(bookings)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Must be signed in to book" }, { status: 401 })
  }

  const data = await req.json()

  if (!data.workshopId) {
    return NextResponse.json({ error: "Workshop ID is required" }, { status: 400 })
  }

  const booking = await prisma.classBooking.create({
    data: {
      workshopId: data.workshopId,
      userId: session.user.id,
      preferredDate: data.preferredDate || null,
      participants: data.participants || 1,
      notes: data.notes || null,
      contactName: session.user.name || data.contactName || "",
      contactEmail: session.user.email || data.contactEmail || "",
      contactPhone: data.contactPhone || null,
    },
  })

  return NextResponse.json(booking)
}
