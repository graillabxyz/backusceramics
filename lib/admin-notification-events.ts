import { prisma } from "@/lib/prisma"
import { formatPrice, isCupCategory } from "@/lib/pos-catalog"
import { workshops } from "@/lib/classes-data"

type SaleItemSnapshot = {
  nameSnapshot: string
  categorySnapshot: string
  quantity: number
  lineTotal: number
}

type PaidSaleSnapshot = {
  id: string
  total: number
  currency: string
  paymentMethod: string
  items: SaleItemSnapshot[]
}

type ClassBookingSnapshot = {
  id: string
  workshopId: string
  preferredDate: string | null
  participants: number
  contactName: string
  contactEmail: string
  contactPhone: string | null
  paymentReference: string | null
  paymentSessionId: string | null
}

async function createAdminNotification(input: {
  type: string
  title: string
  message: string
  path?: string
  dedupeKey?: string
  metadata?: Record<string, unknown>
}) {
  try {
    if (input.dedupeKey) {
      const existing = await prisma.adminNotification.findFirst({
        where: {
          type: input.type,
          metadata: { contains: input.dedupeKey },
        },
      })
      if (existing) return
    }

    await prisma.adminNotification.create({
      data: {
        type: input.type,
        title: input.title,
        message: input.message,
        path: input.path || null,
        metadata: input.metadata ? JSON.stringify({ ...input.metadata, dedupeKey: input.dedupeKey || null }) : null,
      },
    })
  } catch (error) {
    console.error("Could not create admin notification", {
      type: input.type,
      error,
    })
  }
}

function compactItemList(items: SaleItemSnapshot[]) {
  const names = items.map((item) => `${item.quantity} x ${item.nameSnapshot}`)
  if (names.length <= 3) return names.join(", ")
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`
}

export async function notifyCupSalePaid(sale: PaidSaleSnapshot, source: string) {
  const cupItems = sale.items.filter((item) => isCupCategory(item.categorySnapshot))
  if (cupItems.length === 0) return

  const cupCount = cupItems.reduce((sum, item) => sum + item.quantity, 0)
  const title = cupCount === 1 ? "Cup sold" : "Cups sold"
  const itemList = compactItemList(cupItems)

  await createAdminNotification({
    type: "CUP_SOLD",
    title,
    message: `${cupCount} ${cupCount === 1 ? "cup" : "cups"} sold via ${source}: ${itemList}. Total ${formatPrice(sale.total)}.`,
    path: "/admin/pos",
    dedupeKey: `cup_sale:${sale.id}`,
    metadata: {
      saleId: sale.id,
      currency: sale.currency,
      paymentMethod: sale.paymentMethod,
      source,
      cupCount,
      cupItems: cupItems.map((item) => ({
        name: item.nameSnapshot,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
    },
  })
}

export async function notifyClassBookingsConfirmed(bookings: ClassBookingSnapshot[]) {
  if (bookings.length === 0) return

  const first = bookings[0]
  const workshop = workshops.find((item) => item.id === first.workshopId)
  const workshopTitle = workshop?.title || first.workshopId
  const seats = first.participants
  const meetingCount = bookings.length
  const firstDate = first.preferredDate ? ` First date: ${first.preferredDate}.` : ""

  await createAdminNotification({
    type: "CLASS_BOOKED",
    title: "Class booked",
    message: `${first.contactName} booked ${workshopTitle} for ${seats} ${seats === 1 ? "seat" : "seats"}${meetingCount > 1 ? ` across ${meetingCount} dates` : ""}.${firstDate}`,
    path: "/admin/bookings",
    dedupeKey: `class_booking:${first.paymentReference || first.paymentSessionId || first.id}`,
    metadata: {
      bookingIds: bookings.map((booking) => booking.id),
      workshopId: first.workshopId,
      workshopTitle,
      seats,
      meetingCount,
      contactName: first.contactName,
      contactEmail: first.contactEmail,
      contactPhone: first.contactPhone,
      paymentReference: first.paymentReference,
      paymentSessionId: first.paymentSessionId,
      preferredDates: bookings.map((booking) => booking.preferredDate).filter(Boolean),
    },
  })
}
