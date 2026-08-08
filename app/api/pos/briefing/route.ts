import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { getPosOperatorFromRequest } from "@/lib/pos-operator-session"
import { ONLINE_SHOP_NOTE } from "@/lib/pos-sale-payment"
import {
  baliDateKey,
  baliDateKeyToUtc,
  previousBaliDateKey,
} from "@/lib/store-hours"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const operator = await getPosOperatorFromRequest(req)
  if (!operator) {
    return NextResponse.json(
      { error: "Unlock the POS to view the opening briefing.", code: "POS_PIN_LOCKED" },
      { status: 423 }
    )
  }

  const preference = await prisma.userNotificationPreference.upsert({
    where: { userId: session.user.id },
    update: {},
    create: { userId: session.user.id },
  })
  const dateKey = baliDateKey()
  const previousDateKey = previousBaliDateKey(dateKey)
  const overnightStart = baliDateKeyToUtc(previousDateKey, preference.closingTimeMinutes)
  const overnightEnd = baliDateKeyToUtc(dateKey, preference.openingTimeMinutes)
  const openOrderCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const [bookings, overnightSales, openOrders] = await Promise.all([
    prisma.classBooking.findMany({
      where: {
        status: "CONFIRMED",
        archivedAt: null,
        preferredDate: { startsWith: dateKey },
      },
      orderBy: [{ preferredDate: "asc" }, { contactName: "asc" }],
      select: {
        id: true,
        workshopId: true,
        preferredDate: true,
        participants: true,
        contactName: true,
        contactPhone: true,
      },
    }),
    prisma.posSale.findMany({
      where: {
        status: "PAID",
        fulfilledAt: null,
        notes: { startsWith: ONLINE_SHOP_NOTE },
        createdAt: { gte: overnightStart, lt: overnightEnd },
      },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    }),
    prisma.posSale.findMany({
      where: {
        status: "PAID",
        fulfilledAt: null,
        notes: { startsWith: ONLINE_SHOP_NOTE },
        createdAt: { gte: openOrderCutoff },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { items: true },
    }),
  ])

  return NextResponse.json({
    dateKey,
    generatedAt: new Date().toISOString(),
    preference,
    bookings,
    overnightSales,
    openOrders,
  })
}
