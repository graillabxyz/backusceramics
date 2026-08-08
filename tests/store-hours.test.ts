import assert from "node:assert/strict"
import test from "node:test"
import {
  baliDateKey,
  baliDateKeyToUtc,
  formatMinutesAsTime,
  getBaliClock,
  isWithinStoreHours,
  previousBaliDateKey,
} from "../lib/store-hours"

test("converts UTC timestamps to the Bali business clock", () => {
  const clock = getBaliClock(new Date("2026-08-08T00:30:00.000Z"))
  assert.deepEqual(clock, {
    dateKey: "2026-08-08",
    hour: 8,
    minute: 30,
    minutes: 510,
  })
})

test("treats opening as inclusive and closing as exclusive", () => {
  assert.equal(isWithinStoreHours(new Date("2026-08-08T00:29:59.000Z")), false)
  assert.equal(isWithinStoreHours(new Date("2026-08-08T00:30:00.000Z")), true)
  assert.equal(isWithinStoreHours(new Date("2026-08-08T08:59:59.000Z")), true)
  assert.equal(isWithinStoreHours(new Date("2026-08-08T09:00:00.000Z")), false)
})

test("builds reliable Bali business-day boundaries", () => {
  assert.equal(baliDateKeyToUtc("2026-08-08", 510).toISOString(), "2026-08-08T00:30:00.000Z")
  assert.equal(previousBaliDateKey("2026-08-08"), "2026-08-07")
  assert.equal(baliDateKey(new Date("2026-08-07T16:30:00.000Z")), "2026-08-08")
})

test("formats configurable opening and closing times", () => {
  assert.equal(formatMinutesAsTime(510), "8:30 AM")
  assert.equal(formatMinutesAsTime(1020), "5:00 PM")
})
