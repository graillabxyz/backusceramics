export function isResidencySelectionComplete(
  weekCounts: Iterable<number>,
  durationWeeks: number
) {
  if (!Number.isInteger(durationWeeks) || durationWeeks < 1) return false
  const counts = Array.from(weekCounts)
  return counts.length === durationWeeks && counts.every((count) => count >= 5 && count <= 6)
}
