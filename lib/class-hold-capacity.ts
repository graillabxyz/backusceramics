import { prisma } from "@/lib/prisma"
import type { ValidatedClassHold } from "@/lib/class-hold-validation"
import {
  buildDefaultRangeSessions,
  buildRangeSessionsFromSchedules,
  classSeatPoolKey,
  normalizeTimeLabel,
  parsePreferredDate,
  parseWeekdays,
  type CalendarSession,
} from "@/lib/class-schedule"

interface CapacityRequest {
  dateKey: string
  timeLabel: string
  capacity: number
}

interface ValidateClassHoldCapacityOptions {
  excludeHoldId?: string
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
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

function sessionCapacity(session: CalendarSession) {
  return session.maxParticipants ?? session.workshop.maxParticipants ?? 8
}

function buildRequestedSeatPools(holdData: ValidatedClassHold, sessions: CalendarSession[]) {
  const requested = new Map<string, CapacityRequest>()
  const requestedTime = normalizeTimeLabel(holdData.timeLabel)
  const rangeStart = startOfDay(holdData.startDate)
  const rangeEnd = endOfDay(holdData.endDate ?? holdData.startDate)

  for (const session of sessions) {
    if (normalizeTimeLabel(session.timeLabel) !== requestedTime) continue
    if (!holdData.weekdays.includes(session.date.getDay())) continue
    if (session.date < rangeStart || session.date > rangeEnd) continue

    const key = classSeatPoolKey(session.dateKey, session.timeLabel)
    const existing = requested.get(key)
    const capacity = sessionCapacity(session)
    requested.set(key, {
      dateKey: session.dateKey,
      timeLabel: session.timeLabel,
      capacity: existing ? Math.min(existing.capacity, capacity) : capacity,
    })
  }

  return requested
}

export async function validateClassHoldCapacity(
  holdData: ValidatedClassHold,
  options: ValidateClassHoldCapacityOptions = {}
) {
  if ((holdData.status || "ACTIVE") !== "ACTIVE") return null

  const rangeStart = startOfDay(holdData.startDate)
  const rangeEnd = endOfDay(holdData.endDate ?? holdData.startDate)
  const schedules = await prisma.classSchedule.findMany({
    where: {
      status: "ACTIVE",
      startDate: { lte: rangeEnd },
      OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
    },
  })

  const sessions = mergeSessions(
    buildDefaultRangeSessions(rangeStart, rangeEnd),
    schedules.length > 0 ? buildRangeSessionsFromSchedules(rangeStart, rangeEnd, schedules) : []
  )
  const requestedSeatPools = buildRequestedSeatPools(holdData, sessions)

  if (requestedSeatPools.size === 0) {
    return {
      error: "No public class slots match that date, day, and time. Add a calendar schedule first or choose a time with open studio seats.",
      status: 409,
    }
  }

  const dateKeys = Array.from(new Set(Array.from(requestedSeatPools.values()).map((item) => item.dateKey)))
  const [bookings, holds] = await Promise.all([
    prisma.classBooking.findMany({
      where: {
        ...activeBookingStatusWhere(),
        OR: dateKeys.map((dateKey) => ({
          preferredDate: { startsWith: dateKey },
        })),
      },
      select: {
        preferredDate: true,
        participants: true,
      },
    }),
    prisma.classHold.findMany({
      where: {
        status: "ACTIVE",
        ...(options.excludeHoldId ? { id: { not: options.excludeHoldId } } : {}),
        startDate: { lte: rangeEnd },
        OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
      },
      select: {
        id: true,
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

    const key = classSeatPoolKey(preferred.dateKey, preferred.timeLabel)
    if (!requestedSeatPools.has(key)) continue
    bookedSeats.set(key, (bookedSeats.get(key) || 0) + booking.participants)
  }

  const heldSeats = new Map<string, number>()
  for (const hold of holds) {
    const weekdays = parseWeekdays(hold.weekdays)
    const countedKeys = new Set<string>()
    const holdTime = normalizeTimeLabel(hold.timeLabel)
    const holdStart = startOfDay(hold.startDate)
    const holdEnd = hold.endDate ? endOfDay(hold.endDate) : null

    for (const session of sessions) {
      if (normalizeTimeLabel(session.timeLabel) !== holdTime) continue
      if (!weekdays.includes(session.date.getDay())) continue
      if (session.date < holdStart) continue
      if (holdEnd && session.date > holdEnd) continue

      const key = classSeatPoolKey(session.dateKey, session.timeLabel)
      if (!requestedSeatPools.has(key) || countedKeys.has(key)) continue
      countedKeys.add(key)
      heldSeats.set(key, (heldSeats.get(key) || 0) + hold.seats)
    }
  }

  for (const [key, request] of requestedSeatPools) {
    const occupiedSeats = (bookedSeats.get(key) || 0) + (heldSeats.get(key) || 0)
    const availableSeats = request.capacity - occupiedSeats

    if (holdData.seats > availableSeats) {
      return {
        error: `${request.dateKey} at ${request.timeLabel} only has ${Math.max(availableSeats, 0)} open seat${availableSeats === 1 ? "" : "s"}.`,
        status: 409,
      }
    }
  }

  return null
}
