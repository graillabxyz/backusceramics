import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  addDays,
  buildWeekSessionsFromSchedules,
  formatDateKey,
  parseDateKey,
  parsePreferredDate,
  parseWeekdays,
  sessionKey,
  startOfWeek,
} from "@/lib/class-schedule"

function parseWeekStart(value: string | null) {
  if (!value) return startOfWeek(new Date())
  return startOfWeek(parseDateKey(value))
}

export async function GET(req: NextRequest) {
  const weekStart = parseWeekStart(req.nextUrl.searchParams.get("weekStart"))
  const weekEnd = addDays(weekStart, 6)
  const schedules = await prisma.classSchedule.findMany({
    where: {
      status: "ACTIVE",
      startDate: { lte: weekEnd },
      OR: [{ endDate: null }, { endDate: { gte: weekStart } }],
    },
  })
  const sessions = buildWeekSessionsFromSchedules(weekStart, schedules)
  const dateKeys = Array.from(new Set(sessions.map((session) => session.dateKey)))

  const [bookings, holds] = await Promise.all([
    prisma.classBooking.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        OR: dateKeys.map((dateKey) => ({
          preferredDate: { startsWith: dateKey },
        })),
      },
      select: {
        workshopId: true,
        scheduleId: true,
        preferredDate: true,
        participants: true,
      },
    }),
    prisma.classHold.findMany({
      where: {
        status: "ACTIVE",
        startDate: { lte: weekEnd },
        OR: [{ endDate: null }, { endDate: { gte: weekStart } }],
      },
      select: {
        id: true,
        studentName: true,
        workshopId: true,
        timeLabel: true,
        seats: true,
        weekdays: true,
        startDate: true,
        endDate: true,
      },
    }),
  ])

  const bookedSeats = new Map<string, number>()
  for (const booking of bookings) {
    const preferred = parsePreferredDate(booking.preferredDate)
    if (!preferred) continue

    const key = booking.scheduleId
      ? booking.scheduleId
      : sessionKey(booking.workshopId, preferred.dateKey, preferred.timeLabel)
    bookedSeats.set(key, (bookedSeats.get(key) || 0) + booking.participants)
  }

  const heldSeats = new Map<string, number>()
  const holdDetails = new Map<string, { id: string; studentName: string; seats: number }[]>()

  for (const hold of holds) {
    const weekdays = parseWeekdays(hold.weekdays)

    for (const session of sessions) {
      if (session.workshop.id !== hold.workshopId || session.timeLabel !== hold.timeLabel) continue
      if (!weekdays.includes(session.date.getDay())) continue
      if (session.date < hold.startDate) continue
      if (hold.endDate && session.date > hold.endDate) continue

      const key = session.scheduleId || sessionKey(session.workshop.id, session.dateKey, session.timeLabel)
      heldSeats.set(key, (heldSeats.get(key) || 0) + hold.seats)
      holdDetails.set(key, [
        ...(holdDetails.get(key) || []),
        { id: hold.id, studentName: hold.studentName, seats: hold.seats },
      ])
    }
  }

  const availability = sessions.map((session) => {
    const key = session.scheduleId || sessionKey(session.workshop.id, session.dateKey, session.timeLabel)
    const maxParticipants = session.maxParticipants ?? session.workshop.maxParticipants ?? 8
    const booked = bookedSeats.get(key) || 0
    const held = heldSeats.get(key) || 0

    return {
      sessionId: session.id,
      scheduleId: session.scheduleId,
      workshopId: session.workshop.id,
      title: session.scheduleTitle || session.workshop.title,
      category: session.scheduleCategory || "class",
      dateKey: session.dateKey,
      timeLabel: session.timeLabel,
      maxParticipants,
      bookedSeats: booked,
      heldSeats: held,
      availableSeats: Math.max(maxParticipants - booked - held, 0),
      holds: holdDetails.get(key) || [],
    }
  })

  const serializedSessions = sessions.map((session) => ({
    id: session.id,
    scheduleId: session.scheduleId,
    workshopId: session.workshop.id,
    title: session.scheduleTitle || session.workshop.title,
    category: session.scheduleCategory || "class",
    dateKey: session.dateKey,
    timeLabel: session.timeLabel,
    maxParticipants: session.maxParticipants ?? session.workshop.maxParticipants ?? 8,
  }))

  return NextResponse.json({ weekStart: formatDateKey(weekStart), sessions: serializedSessions, availability })
}
