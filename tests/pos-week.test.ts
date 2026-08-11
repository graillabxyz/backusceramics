import assert from "node:assert/strict"
import test from "node:test"
import { getBaliBusinessWeek, getBaliDateKey } from "../lib/pos-week"

test("POS week runs from Monday through Saturday", () => {
  const week = getBaliBusinessWeek("2026-08-15")
  assert.equal(week.weekStart, "2026-08-10")
  assert.equal(week.weekEnd, "2026-08-15")
  assert.deepEqual(week.dates, ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15"])
})

test("Sunday belongs to the shop week that just ended", () => {
  const week = getBaliBusinessWeek("2026-08-16")
  assert.equal(week.weekStart, "2026-08-10")
  assert.equal(week.weekEnd, "2026-08-15")
})

test("Bali date keys respect the UTC plus eight boundary", () => {
  assert.equal(getBaliDateKey(new Date("2026-08-09T15:59:59.000Z")), "2026-08-09")
  assert.equal(getBaliDateKey(new Date("2026-08-09T16:00:00.000Z")), "2026-08-10")
})
