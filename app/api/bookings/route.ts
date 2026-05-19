import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getScheduleOffering, parseDateKey, parsePreferredDate, parseWeekdays, sessionKey } from "@/lib/class-schedule"

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

  const workshop = getScheduleOffering(data.workshopId)
  if (!workshop) {
    return NextResponse.json({ error: "Workshop not found" }, { status: 404 })
  }

  const participants = Number(data.participants || 1)
  const maxParticipants = workshop.maxParticipants ?? 8

  if (!Number.isInteger(participants) || participants < 1) {
    return NextResponse.json({ error: "Participant count is invalid" }, { status: 400 })
  }

  if (participants > maxParticipants) {
    return NextResponse.json(
      { error: `This session can host up to ${maxParticipants} ${maxParticipants === 1 ? "person" : "people"}` },
      { status: 400 }
    )
  }

  const preferred = parsePreferredDate(data.preferredDate)
  if (preferred) {
    const schedule = data.scheduleId
      ? await prisma.classSchedule.findUnique({ where: { id: data.scheduleId } })
      : null
    const capacity = schedule?.maxParticipants ?? maxParticipants
    const sessionDate = parseDateKey(preferred.dateKey)
    const [existingBookings, holds] = await Promise.all([
      prisma.classBooking.findMany({
        where: {
          workshopId: workshop.id,
          ...(schedule ? { scheduleId: schedule.id } : {}),
          status: { in: ["PENDING", "CONFIRMED"] },
          ...(schedule ? {} : { preferredDate: { startsWith: preferred.dateKey } }),
        },
        select: {
          scheduleId: true,
          preferredDate: true,
          participants: true,
        },
      }),
      prisma.classHold.findMany({
        where: {
          workshopId: workshop.id,
          timeLabel: preferred.timeLabel,
          status: "ACTIVE",
          startDate: { lte: sessionDate },
          OR: [{ endDate: null }, { endDate: { gte: sessionDate } }],
        },
        select: {
          seats: true,
          weekdays: true,
        },
      }),
    ])

    const key = schedule?.id || sessionKey(workshop.id, preferred.dateKey, preferred.timeLabel)
    const bookedSeats = existingBookings.reduce((sum, booking) => {
      if (schedule && booking.scheduleId === schedule.id) return sum + booking.participants
      const bookingPreferred = parsePreferredDate(booking.preferredDate)
      if (!bookingPreferred) return sum
      return sessionKey(workshop.id, bookingPreferred.dateKey, bookingPreferred.timeLabel) === key
        ? sum + booking.participants
        : sum
    }, 0)

    const heldSeats = holds.reduce((sum, hold) => {
      return parseWeekdays(hold.weekdays).includes(sessionDate.getDay()) ? sum + hold.seats : sum
    }, 0)

    const availableSeats = capacity - bookedSeats - heldSeats
    if (participants > availableSeats) {
      return NextResponse.json(
        { error: `Only ${Math.max(availableSeats, 0)} ${availableSeats === 1 ? "seat is" : "seats are"} available for that session` },
        { status: 409 }
      )
    }
  }

  const booking = await prisma.classBooking.create({
    data: {
      workshopId: data.workshopId,
      scheduleId: data.scheduleId || null,
      userId: session.user.id,
      preferredDate: data.preferredDate || null,
      participants,
      notes: data.notes || null,
      contactName: session.user.name || data.contactName || "",
      contactEmail: session.user.email || data.contactEmail || "",
      contactPhone: data.contactPhone || null,
    },
  })

  return NextResponse.json(booking)
}
