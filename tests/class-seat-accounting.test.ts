import assert from "node:assert/strict"
import test from "node:test"
import {
  activeSeatBookingWhere,
  activeSeatBookingsForDateKeysWhere,
  calculateSeatUsage,
  holdAppliesToSession,
  lockClassSeatPools,
} from "../lib/class-seat-accounting"
import { validateClassHoldCapacity } from "../lib/class-hold-capacity"
import {
  classSeatPoolKey,
  hasScheduledProgramStarted,
  parseDateKey,
} from "../lib/class-schedule"
import {
  getPaymentSessionExpiresAt,
  PAYMENT_SESSION_DURATION_MINUTES,
} from "../lib/payment-session"
import { getClassBookingPricing, normalizeClassBookingOption } from "../lib/class-booking-pricing"
import { workshops } from "../lib/classes-data"
import { isResidencySelectionComplete, replaceResidencyMonthRecords } from "../lib/residency-selection"
import type { Prisma } from "@prisma/client"

const monday = parseDateKey("2026-07-13")
const tuesday = parseDateKey("2026-07-14")
const morningSession = {
  date: monday,
  dateKey: "2026-07-13",
  timeLabel: "10:00 - 12:00 PM",
}

test("only confirmed bookings and unexpired payment holds consume seats", () => {
  const now = new Date("2026-07-12T04:00:00.000Z")
  const where = activeSeatBookingWhere(now)

  assert.deepEqual(where, {
    OR: [
      { status: "CONFIRMED" },
      { status: "PENDING", holdExpiresAt: { gt: now } },
    ],
  })
})

test("date filtering preserves active booking status conditions", () => {
  const now = new Date("2026-07-12T04:00:00.000Z")

  assert.deepEqual(activeSeatBookingsForDateKeysWhere(["2026-07-13", "2026-07-14"], now), {
    AND: [
      activeSeatBookingWhere(now),
      {
        OR: [
          { preferredDate: { startsWith: "2026-07-13" } },
          { preferredDate: { startsWith: "2026-07-14" } },
        ],
      },
    ],
  })
})

test("a one-day manual hold applies only to its exact date, weekday, and time", () => {
  const hold = {
    id: "hold-1",
    studentName: "External booking",
    timeLabel: "10:00 - 12:00 PM",
    seats: 2,
    weekdays: "[1]",
    startDate: monday,
    endDate: monday,
  }

  assert.equal(holdAppliesToSession(hold, morningSession), true)
  assert.equal(holdAppliesToSession(hold, { ...morningSession, date: tuesday, dateKey: "2026-07-14" }), false)
  assert.equal(holdAppliesToSession(hold, { ...morningSession, timeLabel: "12:00 - 14:00 PM" }), false)
})

test("duplicate offerings sharing a physical time pool count one hold once", () => {
  const duplicateSessions = [morningSession, { ...morningSession }, { ...morningSession }]
  const hold = {
    id: "hold-1",
    studentName: "Resident",
    timeLabel: morningSession.timeLabel,
    seats: 1,
    weekdays: "[1]",
    startDate: monday,
    endDate: monday,
  }
  const usage = calculateSeatUsage(duplicateSessions, [], [hold])
  const key = classSeatPoolKey(morningSession.dateKey, morningSession.timeLabel)

  assert.equal(usage.heldSeats.get(key), 1)
  assert.deepEqual(usage.holdDetails.get(key), [{ id: "hold-1", studentName: "Resident", seats: 1 }])
})

test("bookings and manual holds combine in the same physical seat pool", () => {
  const hold = {
    id: "hold-1",
    studentName: "External booking",
    timeLabel: morningSession.timeLabel,
    seats: 1,
    weekdays: "[1]",
    startDate: monday,
    endDate: monday,
  }
  const usage = calculateSeatUsage(
    [morningSession],
    [{ preferredDate: "2026-07-13 · 10:00 - 12:00 PM", participants: 1 }],
    [hold]
  )
  const key = classSeatPoolKey(morningSession.dateKey, morningSession.timeLabel)

  assert.equal(usage.bookedSeats.get(key), 1)
  assert.equal(usage.heldSeats.get(key), 1)
  assert.equal(3 - (usage.bookedSeats.get(key) || 0) - (usage.heldSeats.get(key) || 0), 1)
})

test("a malformed booking date never consumes a seat", () => {
  const usage = calculateSeatUsage(
    [morningSession],
    [{ preferredDate: "2026-07-13", participants: 3 }],
    []
  )
  const key = classSeatPoolKey(morningSession.dateKey, morningSession.timeLabel)

  assert.equal(usage.bookedSeats.get(key), undefined)
})

test("equivalent time labels share a seat pool after whitespace normalization", () => {
  const usage = calculateSeatUsage(
    [morningSession],
    [{ preferredDate: "2026-07-13 · 10:00   -   12:00 PM", participants: 1 }],
    []
  )
  const key = classSeatPoolKey(morningSession.dateKey, morningSession.timeLabel)

  assert.equal(usage.bookedSeats.get(key), 1)
})

test("a booking at another time does not consume this pool", () => {
  const usage = calculateSeatUsage(
    [morningSession],
    [{ preferredDate: "2026-07-13 · 12:00 - 14:00 PM", participants: 2 }],
    []
  )
  const key = classSeatPoolKey(morningSession.dateKey, morningSession.timeLabel)

  assert.equal(usage.bookedSeats.get(key), undefined)
})

test("a recurring hold applies on selected weekdays within its date range", () => {
  const hold = {
    id: "resident-hold",
    studentName: "Resident",
    timeLabel: morningSession.timeLabel,
    seats: 1,
    weekdays: "[1,3,5]",
    startDate: parseDateKey("2026-07-13"),
    endDate: parseDateKey("2026-07-17"),
  }

  assert.equal(holdAppliesToSession(hold, morningSession), true)
  assert.equal(holdAppliesToSession(hold, { date: tuesday, dateKey: "2026-07-14", timeLabel: morningSession.timeLabel }), false)
  assert.equal(holdAppliesToSession(hold, { date: parseDateKey("2026-07-15"), dateKey: "2026-07-15", timeLabel: morningSession.timeLabel }), true)
  assert.equal(holdAppliesToSession(hold, { date: parseDateKey("2026-07-20"), dateKey: "2026-07-20", timeLabel: morningSession.timeLabel }), false)
})

test("multiple independent holds add together without crossing time pools", () => {
  const holds = [
    {
      id: "hold-1",
      studentName: "One",
      timeLabel: morningSession.timeLabel,
      seats: 1,
      weekdays: "[1]",
      startDate: monday,
      endDate: monday,
    },
    {
      id: "hold-2",
      studentName: "Two",
      timeLabel: morningSession.timeLabel,
      seats: 2,
      weekdays: "[1]",
      startDate: monday,
      endDate: monday,
    },
    {
      id: "afternoon",
      studentName: "Other pool",
      timeLabel: "12:00 - 14:00 PM",
      seats: 3,
      weekdays: "[1]",
      startDate: monday,
      endDate: monday,
    },
  ]
  const usage = calculateSeatUsage([morningSession], [], holds)
  const key = classSeatPoolKey(morningSession.dateKey, morningSession.timeLabel)

  assert.equal(usage.heldSeats.get(key), 3)
  assert.equal(usage.holdDetails.get(key)?.length, 2)
})

test("transaction seat locks cast PostgreSQL void results for Prisma driver adapters", async () => {
  const lockQueries: string[] = []
  const db = {
    classSchedule: {
      findMany: async () => [],
    },
    classBooking: {
      findMany: async () => [],
    },
    classHold: {
      findMany: async () => [],
    },
    $queryRaw: async (query: TemplateStringsArray) => {
      lockQueries.push(query.join("?"))
      return [{ lock: "" }]
    },
  } as unknown as Prisma.TransactionClient

  const result = await validateClassHoldCapacity({
    studentName: "External booking",
    studentEmail: null,
    workshopId: "beginner-wheel",
    timeLabel: morningSession.timeLabel,
    seats: 1,
    weekdays: [1],
    startDate: monday,
    endDate: monday,
    notes: null,
    status: "ACTIVE",
  }, { db, lockSeatPools: true })

  assert.equal(result, null)
  assert.ok(lockQueries.length > 0)
  assert.ok(lockQueries.every((query) => query.includes("pg_advisory_xact_lock") && query.includes("::text")))
})

test("customer payment locks deduplicate and sort shared seat pools", async () => {
  const lockQueries: string[] = []
  const db = {
    $queryRaw: async (query: TemplateStringsArray) => {
      lockQueries.push(query.join("?"))
      return [{ lock: "" }]
    },
  } as unknown as Pick<Prisma.TransactionClient, "$queryRaw">

  await lockClassSeatPools(db, ["2026-07-14|10:00", "2026-07-13|10:00", "2026-07-14|10:00"])

  assert.equal(lockQueries.length, 2)
  assert.ok(lockQueries.every((query) => query.includes("pg_advisory_xact_lock") && query.includes("::text")))
})

test("payment session expiry and local seat hold use the same provider-safe duration", () => {
  const now = new Date("2026-07-16T04:00:00.000Z")
  const expiresAt = getPaymentSessionExpiresAt(now)

  assert.equal(PAYMENT_SESSION_DURATION_MINUTES, 15)
  assert.equal(expiresAt.getTime() - now.getTime(), 15 * 60 * 1000)
})

test("residency availability keeps other loaded months while refreshing the active month", () => {
  const current = [
    { id: "old-july", dateKey: "2026-07-20" },
    { id: "august", dateKey: "2026-08-03" },
  ]
  const next = [{ id: "new-july", dateKey: "2026-07-21" }]

  assert.deepEqual(replaceResidencyMonthRecords(current, next, "2026-07-01"), [
    { id: "august", dateKey: "2026-08-03" },
    { id: "new-july", dateKey: "2026-07-21" },
  ])
})

test("kids pricing reserves two seats for each parent and child booking", () => {
  const workshop = workshops.find((item) => item.id === "kids-workshop")
  assert.ok(workshop)
  const option = normalizeClassBookingOption(workshop, "parent-child")
  const pricing = getClassBookingPricing(workshop, option, 2)
  assert.deepEqual(pricing, {
    option: "parent-child",
    label: "Parent & Child",
    bookingUnits: 2,
    participants: 4,
    unitPrice: 500000,
    total: 1000000,
  })
})

test("unsupported class pricing options use server-controlled standard pricing", () => {
  const workshop = workshops.find((item) => item.id === "beginner-wheel")
  assert.ok(workshop)
  const option = normalizeClassBookingOption(workshop, "parent-child")
  const pricing = getClassBookingPricing(workshop, option, 2)
  assert.equal(option, "standard")
  assert.equal(pricing?.participants, 2)
  assert.equal(pricing?.total, workshop.price * 2)
})

test("residencies accept five or six days in each selected week", () => {
  assert.equal(isResidencySelectionComplete([5, 5, 5], 3), true)
  assert.equal(isResidencySelectionComplete([6, 5, 6], 3), true)
  assert.equal(isResidencySelectionComplete([5, 5], 3), false)
  assert.equal(isResidencySelectionComplete([4, 5, 6], 3), false)
  assert.equal(isResidencySelectionComplete([5, 5, 5, 5], 3), false)
})

test("a scheduled multi-day run disappears after its first meeting starts", () => {
  const session = {
    id: "schedule-1-2026-07-17-10:00",
    scheduleId: "schedule-1",
    workshop: { id: "3-day-workshop" },
    date: parseDateKey("2026-07-17"),
    dateKey: "2026-07-17",
    timeLabel: "10:00 - 12:00 PM",
    scheduleLabel: "Scheduled run",
    sortHour: 10,
    scheduleCategory: "multi-day",
    scheduleStartDate: parseDateKey("2026-07-16"),
  } as Parameters<typeof hasScheduledProgramStarted>[0]

  assert.equal(hasScheduledProgramStarted(session, new Date("2026-07-16T01:59:59.000Z")), false)
  assert.equal(hasScheduledProgramStarted(session, new Date("2026-07-16T02:00:00.000Z")), true)
})

test("default workshop sequences remain bookable from any valid future start date", () => {
  const session = {
    id: "3-day-workshop-2026-07-17-10:00",
    workshop: { id: "3-day-workshop" },
    date: parseDateKey("2026-07-17"),
    dateKey: "2026-07-17",
    timeLabel: "10:00 - 12:00 PM",
    scheduleLabel: "Friday: 10:00 - 12:00 PM",
    sortHour: 10,
  } as Parameters<typeof hasScheduledProgramStarted>[0]

  assert.equal(hasScheduledProgramStarted(session, new Date("2026-07-17T02:00:00.000Z")), false)
})
