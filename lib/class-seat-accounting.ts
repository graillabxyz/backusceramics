import type { Prisma } from "@prisma/client"
import {
  classSeatPoolKey,
  normalizeTimeLabel,
  parsePreferredDate,
  parseWeekdays,
} from "@/lib/class-schedule"

export interface SeatPoolSession {
  date: Date
  dateKey: string
  timeLabel: string
}

export interface SeatBookingRecord {
  preferredDate: string | null
  participants: number
}

export interface SeatHoldRecord {
  id: string
  studentName?: string
  timeLabel: string
  seats: number
  weekdays: string
  startDate: Date
  endDate: Date | null
}

export interface SeatHoldDetail {
  id: string
  studentName: string
  seats: number
}

type SeatLockDb = Pick<Prisma.TransactionClient, "$queryRaw">

export async function lockClassSeatPools(db: SeatLockDb, seatPoolKeys: Iterable<string>) {
  const sortedKeys = Array.from(new Set(seatPoolKeys)).sort()

  for (const seatPoolKey of sortedKeys) {
    // PostgreSQL returns void here. Prisma's pg driver adapter needs a
    // supported scalar result even though we only care that the lock completed.
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${seatPoolKey}))::text AS "lock"`
  }
}

export function activeSeatBookingWhere(now = new Date()): Prisma.ClassBookingWhereInput {
  return {
    OR: [
      { status: "CONFIRMED" },
      {
        status: "PENDING",
        holdExpiresAt: { gt: now },
      },
    ],
  }
}

export function activeSeatBookingsForDateKeysWhere(dateKeys: string[], now = new Date()): Prisma.ClassBookingWhereInput {
  return {
    AND: [
      activeSeatBookingWhere(now),
      {
        OR: dateKeys.map((dateKey) => ({
          preferredDate: { startsWith: dateKey },
        })),
      },
    ],
  }
}

export function mergeCalendarSessions<T extends SeatPoolSession>(defaultSessions: T[], scheduledSessions: T[]) {
  const sessions = new Map<string, T>()

  for (const session of defaultSessions) {
    sessions.set(sessionIdentity(session), session)
  }

  for (const session of scheduledSessions) {
    sessions.set(sessionIdentity(session), session)
  }

  return Array.from(sessions.values())
}

function sessionIdentity(session: SeatPoolSession & { workshop?: { id: string }; scheduleId?: string }) {
  return `${session.workshop?.id || session.scheduleId || "session"}|${session.dateKey}|${normalizeTimeLabel(session.timeLabel)}`
}

export function holdAppliesToSession(hold: SeatHoldRecord, session: SeatPoolSession) {
  if (normalizeTimeLabel(hold.timeLabel) !== normalizeTimeLabel(session.timeLabel)) return false
  if (!parseWeekdays(hold.weekdays).includes(session.date.getDay())) return false

  const sessionTime = session.date.getTime()
  const start = startOfDay(hold.startDate).getTime()
  const end = hold.endDate ? endOfDay(hold.endDate).getTime() : Number.POSITIVE_INFINITY
  return sessionTime >= start && sessionTime <= end
}

export function calculateSeatUsage(
  sessions: SeatPoolSession[],
  bookings: SeatBookingRecord[],
  holds: SeatHoldRecord[]
) {
  const sessionPools = new Set(sessions.map((session) => classSeatPoolKey(session.dateKey, session.timeLabel)))
  const bookedSeats = new Map<string, number>()
  const heldSeats = new Map<string, number>()
  const holdDetails = new Map<string, SeatHoldDetail[]>()

  for (const booking of bookings) {
    const preferred = parsePreferredDate(booking.preferredDate)
    if (!preferred) continue

    const key = classSeatPoolKey(preferred.dateKey, preferred.timeLabel)
    if (!sessionPools.has(key)) continue
    bookedSeats.set(key, (bookedSeats.get(key) || 0) + booking.participants)
  }

  for (const hold of holds) {
    const countedPools = new Set<string>()

    for (const session of sessions) {
      if (!holdAppliesToSession(hold, session)) continue

      const key = classSeatPoolKey(session.dateKey, session.timeLabel)
      if (countedPools.has(key)) continue
      countedPools.add(key)
      heldSeats.set(key, (heldSeats.get(key) || 0) + hold.seats)

      if (hold.studentName) {
        holdDetails.set(key, [
          ...(holdDetails.get(key) || []),
          { id: hold.id, studentName: hold.studentName, seats: hold.seats },
        ])
      }
    }
  }

  return { bookedSeats, heldSeats, holdDetails }
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
