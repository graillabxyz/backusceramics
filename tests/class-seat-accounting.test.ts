import assert from "node:assert/strict"
import test from "node:test"
import {
  activeSeatBookingWhere,
  calculateSeatUsage,
  holdAppliesToSession,
} from "../lib/class-seat-accounting"
import { classSeatPoolKey, parseDateKey } from "../lib/class-schedule"

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
