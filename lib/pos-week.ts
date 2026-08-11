const BALI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000

function normalizeDateKey(dateKey?: string | null) {
  if (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey
  return new Date(Date.now() + BALI_UTC_OFFSET_MS).toISOString().slice(0, 10)
}

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function startOfBaliDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day) - BALI_UTC_OFFSET_MS)
}

export function getBaliBusinessWeek(anchorDate?: string | null) {
  const anchor = normalizeDateKey(anchorDate)
  const [year, month, day] = anchor.split("-").map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1
  const weekStart = shiftDateKey(anchor, -daysSinceMonday)
  const weekEnd = shiftDateKey(weekStart, 5)
  const dates = Array.from({ length: 6 }, (_, index) => shiftDateKey(weekStart, index))

  return {
    anchorDate: anchor,
    weekStart,
    weekEnd,
    weekCode: `${weekStart}_${weekEnd}`,
    dates,
    rangeStart: startOfBaliDate(weekStart),
    rangeEnd: startOfBaliDate(shiftDateKey(weekEnd, 1)),
  }
}

export function getBaliDateKey(value: Date) {
  return new Date(value.getTime() + BALI_UTC_OFFSET_MS).toISOString().slice(0, 10)
}
