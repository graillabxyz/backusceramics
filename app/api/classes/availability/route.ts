import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  addDays,
  buildDefaultRangeSessions,
  buildRangeSessionsFromSchedules,
  buildWeekSessions,
  buildWeekSessionsFromSchedules,
  formatDateKey,
  hasSessionStartPassed,
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

function parseMonthStart(value: string | null) {
  const source = value ? parseDateKey(value) : new Date()
  return new Date(source.getFullYear(), source.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function mergeSessions(defaultSessions: ReturnType<typeof buildWeekSessions>, scheduledSessions: ReturnType<typeof buildWeekSessions>) {
  const sessions = new Map<string, ReturnType<typeof buildWeekSessions>[number]>()

  for (const session of defaultSessions) {
    sessions.set(`${session.workshop.id}|${session.dateKey}|${session.timeLabel}`, session)
  }

  for (const session of scheduledSessions) {
    sessions.set(`${session.workshop.id}|${session.dateKey}|${session.timeLabel}`, session)
  }

  return Array.from(sessions.values()).sort((a, b) => a.date.getTime() - b.date.getTime() || a.sortHour - b.sortHour)
}

function removeStartedSessions(sessions: ReturnType<typeof buildWeekSessions>) {
  return sessions.filter((session) => !hasSessionStartPassed(session.dateKey, session.timeLabel))
}

function buildAvailabilityResponse(rangeStart: Date, sessions: ReturnType<typeof buildWeekSessions>, bookedSeats = new Map<string, number>(), heldSeats = new Map<string, number>(), holdDetails = new Map<string, { id: string; studentName: string; seats: number }[]>()) {
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
    scheduleStartDate: session.scheduleStartDate ? formatDateKey(session.scheduleStartDate) : undefined,
    scheduleEndDate: session.scheduleEndDate ? formatDateKey(session.scheduleEndDate) : undefined,
    scheduleWeekdays: session.scheduleWeekdays ?? undefined,
  }))

  return NextResponse.json({ rangeStart: formatDateKey(rangeStart), sessions: serializedSessions, availability })
}

export async function GET(req: NextRequest) {
  const monthStartParam = req.nextUrl.searchParams.get("monthStart")
  const weekStart = parseWeekStart(req.nextUrl.searchParams.get("weekStart"))
  const rangeStart = monthStartParam ? parseMonthStart(monthStartParam) : weekStart
  const rangeEnd = monthStartParam ? endOfMonth(rangeStart) : addDays(weekStart, 6)
  let schedules = []
  try {
    schedules = await prisma.classSchedule.findMany({
      where: {
        status: "ACTIVE",
        startDate: { lte: rangeEnd },
        OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
      },
    })
  } catch {
    return buildAvailabilityResponse(
      rangeStart,
      removeStartedSessions(monthStartParam ? buildDefaultRangeSessions(rangeStart, rangeEnd) : buildWeekSessions(weekStart))
    )
  }

  const defaultSessions = monthStartParam
    ? buildDefaultRangeSessions(rangeStart, rangeEnd)
    : buildWeekSessions(weekStart)
  const scheduledSessions = schedules.length > 0
    ? monthStartParam
      ? buildRangeSessionsFromSchedules(rangeStart, rangeEnd, schedules)
      : buildWeekSessionsFromSchedules(weekStart, schedules)
    : []
  const sessions = removeStartedSessions(mergeSessions(defaultSessions, scheduledSessions))
  const dateKeys = Array.from(new Set(sessions.map((session) => session.dateKey)))

  let bookings = []
  let holds = []
  try {
    ;[bookings, holds] = await Promise.all([
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
          startDate: { lte: rangeEnd },
          OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
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
  } catch {
    return buildAvailabilityResponse(rangeStart, sessions)
  }

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

  return buildAvailabilityResponse(rangeStart, sessions, bookedSeats, heldSeats, holdDetails)
}
