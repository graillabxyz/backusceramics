import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  addDays,
  buildDefaultRangeSessions,
  buildRangeSessionsFromSchedules,
  buildWeekSessions,
  buildWeekSessionsFromSchedules,
  classSeatPoolKey,
  type CalendarSession,
  formatDateKey,
  hasSessionStartPassed,
  normalizeTimeLabel,
  parseDateKey,
  parsePreferredDate,
  parseWeekdays,
  startOfWeek,
} from "@/lib/class-schedule"
import { isFullAdminRole } from "@/lib/permissions"

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

function mergeSessions(defaultSessions: CalendarSession[], scheduledSessions: CalendarSession[]) {
  const sessions = new Map<string, CalendarSession>()

  for (const session of defaultSessions) {
    sessions.set(`${session.workshop.id}|${session.dateKey}|${session.timeLabel}`, session)
  }

  for (const session of scheduledSessions) {
    sessions.set(`${session.workshop.id}|${session.dateKey}|${session.timeLabel}`, session)
  }

  return Array.from(sessions.values()).sort((a, b) => a.date.getTime() - b.date.getTime() || a.sortHour - b.sortHour)
}

function removeStartedSessions(sessions: CalendarSession[]) {
  return sessions.filter((session) => !hasSessionStartPassed(session.dateKey, session.timeLabel))
}

function buildAvailabilityResponse(rangeStart: Date, sessions: CalendarSession[], bookedSeats = new Map<string, number>(), heldSeats = new Map<string, number>(), holdDetails = new Map<string, { id: string; studentName: string; seats: number }[]>()) {
  const availability = sessions.map((session) => {
    const key = classSeatPoolKey(session.dateKey, session.timeLabel)
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

function activeBookingStatusWhere(now = new Date()) {
  return {
    OR: [
      { status: "CONFIRMED" },
      {
        status: "PENDING",
        OR: [
          { holdExpiresAt: null },
          { holdExpiresAt: { gt: now } },
        ],
      },
    ],
  }
}

export async function GET(req: NextRequest) {
  const monthStartParam = req.nextUrl.searchParams.get("monthStart")
  const includeHoldDetails = req.nextUrl.searchParams.get("includeHoldDetails") === "1"
  let canIncludeHoldDetails = false

  if (includeHoldDetails) {
    try {
      const session = await auth()
      canIncludeHoldDetails = Boolean(session && isFullAdminRole(session.user.role))
    } catch (error) {
      console.error("Could not verify availability hold detail access", error)
    }
  }

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
  } catch (error) {
    console.error("Could not load class schedules for availability", error)
    return NextResponse.json({ error: "Could not load class availability" }, { status: 503 })
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
          ...activeBookingStatusWhere(),
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
  } catch (error) {
    console.error("Could not load bookings or holds for availability", error)
    return NextResponse.json({ error: "Could not load class availability" }, { status: 503 })
  }

  const bookedSeats = new Map<string, number>()
  for (const booking of bookings) {
    const preferred = parsePreferredDate(booking.preferredDate)
    if (!preferred) continue

    const key = classSeatPoolKey(preferred.dateKey, preferred.timeLabel)
    bookedSeats.set(key, (bookedSeats.get(key) || 0) + booking.participants)
  }

  const heldSeats = new Map<string, number>()
  const holdDetails = new Map<string, { id: string; studentName: string; seats: number }[]>()

  for (const hold of holds) {
    const weekdays = parseWeekdays(hold.weekdays)
    const countedKeys = new Set<string>()
    const holdTime = normalizeTimeLabel(hold.timeLabel)

    for (const session of sessions) {
      if (normalizeTimeLabel(session.timeLabel) !== holdTime) continue
      if (!weekdays.includes(session.date.getDay())) continue
      if (session.date < hold.startDate) continue
      if (hold.endDate && session.date > hold.endDate) continue

      const key = classSeatPoolKey(session.dateKey, session.timeLabel)
      if (countedKeys.has(key)) continue
      countedKeys.add(key)

      heldSeats.set(key, (heldSeats.get(key) || 0) + hold.seats)
      holdDetails.set(key, [
        ...(holdDetails.get(key) || []),
        { id: hold.id, studentName: hold.studentName, seats: hold.seats },
      ])
    }
  }

  return buildAvailabilityResponse(
    rangeStart,
    sessions,
    bookedSeats,
    heldSeats,
    canIncludeHoldDetails ? holdDetails : undefined
  )
}
