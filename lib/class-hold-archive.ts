import { prisma } from "@/lib/prisma"

const BALI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000

export function getBaliDateStart(date = new Date()) {
  const dateKey = new Date(date.getTime() + BALI_UTC_OFFSET_MS).toISOString().slice(0, 10)
  return new Date(`${dateKey}T00:00:00.000Z`)
}

export async function archiveExpiredClassHolds(date = new Date()) {
  const archivedAt = new Date()
  const result = await prisma.classHold.updateMany({
    where: {
      status: { in: ["ACTIVE", "PAUSED", "CANCELLED"] },
      endDate: { not: null, lt: getBaliDateStart(date) },
    },
    data: {
      status: "ARCHIVED",
      archivedAt,
    },
  })

  return result.count
}
