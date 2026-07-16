export function isResidencySelectionComplete(
  weekCounts: Iterable<number>,
  durationWeeks: number
) {
  if (!Number.isInteger(durationWeeks) || durationWeeks < 1) return false
  const counts = Array.from(weekCounts)
  return counts.length === durationWeeks && counts.every((count) => count >= 5 && count <= 6)
}

export function replaceResidencyMonthRecords<T extends { dateKey: string }>(
  current: T[],
  next: T[],
  monthStartKey: string
) {
  const monthPrefix = monthStartKey.slice(0, 7)
  return [...current.filter((item) => !item.dateKey.startsWith(monthPrefix)), ...next]
}
