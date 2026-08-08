import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"
import { ONLINE_SHOP_NOTE } from "@/lib/pos-sale-payment"
import { checkRateLimit, cleanString, isRequestBodyTooLarge, rateLimitHeaders } from "@/lib/server-security"
import { reconcileRecentXenditWebsiteSales } from "@/lib/xendit-sale-reconciliation"

const SALE_STATUSES = new Set(["PAID", "PENDING_PAYMENT", "CANCELLED", "VOIDED"])

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rateLimit = checkRateLimit(req, { key: "admin-website-sales", limit: 60, windowMs: 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many refreshes. Wait a moment and try again." },
      { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) }
    )
  }

  const requestedStatus = req.nextUrl.searchParams.get("status")?.trim().toUpperCase() || "ALL"
  if (requestedStatus !== "ALL" && !SALE_STATUSES.has(requestedStatus)) {
    return NextResponse.json({ error: "Invalid sale status" }, { status: 400 })
  }

  const limitParam = Number(req.nextUrl.searchParams.get("limit") || 200)
  const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 250) : 200
  const reconciliation = await reconcileRecentXenditWebsiteSales(12)
  const onlineShopWhere = { notes: { startsWith: ONLINE_SHOP_NOTE } }
  const filteredWhere = requestedStatus === "ALL"
    ? onlineShopWhere
    : { ...onlineShopWhere, status: requestedStatus }

  const [sales, statusGroups, lastWebhook] = await Promise.all([
    prisma.posSale.findMany({
      where: filteredWhere,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        items: true,
        voidedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.posSale.groupBy({
      by: ["status"],
      where: onlineShopWhere,
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.paymentWebhookEvent.findFirst({
      where: { provider: "XENDIT" },
      orderBy: { receivedAt: "desc" },
      select: {
        event: true,
        status: true,
        paymentSessionId: true,
        paymentReference: true,
        receivedAt: true,
      },
    }),
  ])

  const totals = Object.fromEntries(statusGroups.map((group) => [
    group.status,
    {
      count: group._count._all,
      total: group._sum.total || 0,
    },
  ]))

  return NextResponse.json({
    sales,
    totals,
    reconciliation,
    webhook: {
      endpoint: "/api/payments/xendit-webhook",
      lastReceived: lastWebhook,
    },
  })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (isRequestBodyTooLarge(req, 8 * 1024)) {
    return NextResponse.json({ error: "Sale update is too large" }, { status: 413 })
  }

  const data = await req.json().catch(() => ({}))
  const saleId = cleanString(data.saleId, 100)
  if (!saleId || typeof data.fulfilled !== "boolean") {
    return NextResponse.json({ error: "A valid sale and fulfillment state are required" }, { status: 400 })
  }

  const existing = await prisma.posSale.findFirst({
    where: { id: saleId, notes: { startsWith: ONLINE_SHOP_NOTE } },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: "Website sale not found" }, { status: 404 })

  const sale = await prisma.posSale.update({
    where: { id: saleId },
    data: { fulfilledAt: data.fulfilled ? new Date() : null },
    include: { items: true },
  })
  return NextResponse.json({ sale })
}
