export const BALI_TIME_ZONE = "Asia/Makassar"
export const DEFAULT_OPENING_MINUTES = 8 * 60 + 30
export const DEFAULT_CLOSING_MINUTES = 17 * 60

type BaliClock = {
  dateKey: string
  hour: number
  minute: number
  minutes: number
}

function partsFor(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BALI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
}

export function getBaliClock(date = new Date()): BaliClock {
  const values = Object.fromEntries(partsFor(date).map((part) => [part.type, part.value]))
  const hour = Number(values.hour || 0)
  const minute = Number(values.minute || 0)

  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    hour,
    minute,
    minutes: hour * 60 + minute,
  }
}

export function isWithinStoreHours(
  date = new Date(),
  openingMinutes = DEFAULT_OPENING_MINUTES,
  closingMinutes = DEFAULT_CLOSING_MINUTES
) {
  const clock = getBaliClock(date)
  return clock.minutes >= openingMinutes && clock.minutes < closingMinutes
}

export function baliDateKey(date = new Date()) {
  return getBaliClock(date).dateKey
}

export function baliDateKeyToUtc(dateKey: string, minutes = 0) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) throw new Error("Invalid Bali date key")
  const [, year, month, day] = match
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), hour - 8, minute))
}

export function previousBaliDateKey(dateKey: string) {
  const start = baliDateKeyToUtc(dateKey)
  start.setUTCDate(start.getUTCDate() - 1)
  return baliDateKey(start)
}

export function formatMinutesAsTime(minutes: number) {
  const bounded = Math.min(Math.max(Math.round(minutes), 0), 1439)
  const hour = Math.floor(bounded / 60)
  const minute = bounded % 60
  const suffix = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`
}
