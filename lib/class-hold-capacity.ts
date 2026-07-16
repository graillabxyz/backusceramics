import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import type { ValidatedClassHold } from "@/lib/class-hold-validation"
import {
  buildDefaultRangeSessions,
  buildRangeSessionsFromSchedules,
  classSeatPoolKey,
  normalizeTimeLabel,
  type CalendarSession,
} from "@/lib/class-schedule"
import {
  activeSeatBookingsForDateKeysWhere,
  calculateSeatUsage,
  lockClassSeatPools,
  mergeCalendarSessions,
} from "@/lib/class-seat-accounting"

interface CapacityRequest {
  dateKey: string
  timeLabel: string
  capacity: number
}

interface ValidateClassHoldCapacityOptions {
  excludeHoldId?: string
  db?: Prisma.TransactionClient
  lockSeatPools?: boolean
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

  const db = options.db || prisma

  const rangeStart = startOfDay(holdData.startDate)
  const rangeEnd = endOfDay(holdData.endDate ?? holdData.startDate)
  const schedules = await db.classSchedule.findMany({
    where: {
      status: "ACTIVE",
      startDate: { lte: rangeEnd },
      OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
    },
  })

  const sessions = mergeCalendarSessions(
    buildDefaultRangeSessions(rangeStart, rangeEnd),
    schedules.length > 0 ? buildRangeSessionsFromSchedules(rangeStart, rangeEnd, schedules) : []
  ).sort((a, b) => a.date.getTime() - b.date.getTime() || a.sortHour - b.sortHour)
  const requestedSeatPools = buildRequestedSeatPools(holdData, sessions)

  if (requestedSeatPools.size === 0) {
    return {
      error: "No public class slots match that date, day, and time. Add a calendar schedule first or choose a time with open studio seats.",
      status: 409,
    }
  }


  if (options.lockSeatPools) {
    await lockClassSeatPools(db, requestedSeatPools.keys())
  }

  const dateKeys = Array.from(new Set(Array.from(requestedSeatPools.values()).map((item) => item.dateKey)))
  const [bookings, holds] = await Promise.all([
    db.classBooking.findMany({
      where: activeSeatBookingsForDateKeysWhere(dateKeys),
      select: {
        preferredDate: true,
        participants: true,
      },
    }),
    db.classHold.findMany({
      where: {
        status: "ACTIVE",
        ...(options.excludeHoldId ? { id: { not: options.excludeHoldId } } : {}),
        startDate: { lte: rangeEnd },
        OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
      },
      select: {
        id: true,
        studentName: true,
        timeLabel: true,
        seats: true,
        weekdays: true,
        startDate: true,
        endDate: true,
      },
    }),
  ])

  const requestedSessions = sessions.filter((session) => requestedSeatPools.has(classSeatPoolKey(session.dateKey, session.timeLabel)))
  const { bookedSeats, heldSeats } = calculateSeatUsage(requestedSessions, bookings, holds)

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
