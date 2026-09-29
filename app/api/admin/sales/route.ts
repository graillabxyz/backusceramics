import type { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"
import { POS_PAYMENT_METHODS, POS_SALE_STATUSES } from "@/lib/pos-catalog"
import { getSalesChannel, SALES_CHANNELS, type SalesChannel } from "@/lib/sales-ledger"
import { checkRateLimit, cleanString, isRequestBodyTooLarge, rateLimitHeaders } from "@/lib/server-security"
import { reconcileRecentXenditSales } from "@/lib/xendit-sale-reconciliation"

const saleStatuses = new Set<string>(POS_SALE_STATUSES)
const paymentMethods = new Set<string>([...POS_PAYMENT_METHODS, "GIFT_VOUCHER"])
const salesChannels = new Set<string>(SALES_CHANNELS)

function giftVoucherWhere(): Prisma.PosSaleWhereInput {
  return { notes: { contains: "[gift-voucher]" } }
}

function paymentLinkWhere(): Prisma.PosSaleWhereInput {
  return { OR: [{ paymentLinkId: { not: null } }, { notes: { contains: "[payment-link]" } }] }
}

function websiteWhere(): Prisma.PosSaleWhereInput {
  return {
    OR: [
      { notes: { startsWith: "[online-shop]" } },
      {
        operatorId: null,
        paymentMethod: "ONLINE",
        OR: [{ paymentSessionId: { not: null } }, { paymentReference: { not: null } }],
      },
    ],
  }
}

function channelWhere(channel: SalesChannel): Prisma.PosSaleWhereInput {
  if (channel === "GIFT_VOUCHER") return giftVoucherWhere()
  if (channel === "PAYMENT_LINK") return paymentLinkWhere()
  if (channel === "WEBSITE") return { AND: [websiteWhere(), { NOT: [giftVoucherWhere(), paymentLinkWhere()] }] }
  return { NOT: [giftVoucherWhere(), paymentLinkWhere(), websiteWhere()] }
}

function parseDate(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+08:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseCursor(value: string | null) {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { createdAt?: string; id?: string }
    const createdAt = new Date(parsed.createdAt || "")
    if (!parsed.id || Number.isNaN(createdAt.getTime())) return null
    return { createdAt, id: parsed.id }
  } catch {
    return null
  }
}

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), "utf8").toString("base64url")
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rateLimit = checkRateLimit(req, { key: `admin-sales:${session.user.id}`, limit: 90, windowMs: 60_000 })
  if (!rateLimit.allowed) return NextResponse.json({ error: "Too many refreshes. Wait a moment and try again." }, { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) })

  const status = req.nextUrl.searchParams.get("status")?.trim().toUpperCase() || "ALL"
  const channel = req.nextUrl.searchParams.get("channel")?.trim().toUpperCase() || "ALL"
  const paymentMethod = req.nextUrl.searchParams.get("paymentMethod")?.trim().toUpperCase() || "ALL"
  if (status !== "ALL" && !saleStatuses.has(status)) return NextResponse.json({ error: "Invalid sale status" }, { status: 400 })
  if (channel !== "ALL" && !salesChannels.has(channel)) return NextResponse.json({ error: "Invalid sales channel" }, { status: 400 })
  if (paymentMethod !== "ALL" && !paymentMethods.has(paymentMethod)) return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })

  const from = parseDate(req.nextUrl.searchParams.get("from"))
  const to = parseDate(req.nextUrl.searchParams.get("to"), true)
  if (req.nextUrl.searchParams.has("from") && !from) return NextResponse.json({ error: "Invalid start date" }, { status: 400 })
  if (req.nextUrl.searchParams.has("to") && !to) return NextResponse.json({ error: "Invalid end date" }, { status: 400 })
  if (from && to && from > to) return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 })

  const query = cleanString(req.nextUrl.searchParams.get("q"), 100)
  const limitParam = Number(req.nextUrl.searchParams.get("limit") || 75)
  const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 75
  const cursor = parseCursor(req.nextUrl.searchParams.get("cursor"))
  const filters: Prisma.PosSaleWhereInput[] = []

  if (status !== "ALL") filters.push({ status })
  if (channel !== "ALL") filters.push(channelWhere(channel as SalesChannel))
  if (paymentMethod !== "ALL") filters.push({ paymentMethod })
  if (from || to) filters.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } })
  if (query) {
    filters.push({ OR: [
      { id: { contains: query, mode: "insensitive" } },
      { receiptEmail: { contains: query, mode: "insensitive" } },
      { paymentReference: { contains: query, mode: "insensitive" } },
      { paymentSessionId: { contains: query, mode: "insensitive" } },
      { promoCodeSnapshot: { contains: query, mode: "insensitive" } },
      { giftVoucherCodeSnapshot: { contains: query, mode: "insensitive" } },
      { shippingCity: { contains: query, mode: "insensitive" } },
      { notes: { contains: query, mode: "insensitive" } },
      { operator: { is: { name: { contains: query, mode: "insensitive" } } } },
      { operator: { is: { email: { contains: query, mode: "insensitive" } } } },
      { paymentLink: { is: { title: { contains: query, mode: "insensitive" } } } },
      { paymentLink: { is: { customerName: { contains: query, mode: "insensitive" } } } },
      { items: { some: { nameSnapshot: { contains: query, mode: "insensitive" } } } },
      { items: { some: { skuSnapshot: { contains: query, mode: "insensitive" } } } },
    ] })
  }

  const baseWhere: Prisma.PosSaleWhereInput = filters.length ? { AND: filters } : {}
  const pageWhere: Prisma.PosSaleWhereInput = cursor ? { AND: [
    baseWhere,
    { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] },
  ] } : baseWhere

  const reconciliation = req.nextUrl.searchParams.get("reconcile") === "1"
    ? await reconcileRecentXenditSales(20)
    : { checked: 0, updated: 0, failed: 0 }
  const [rows, statusGroups, lastWebhook] = await Promise.all([
    prisma.posSale.findMany({
      where: pageWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        items: { orderBy: { id: "asc" } },
        operator: { select: { id: true, name: true, email: true, image: true } },
        voidedBy: { select: { id: true, name: true, email: true } },
        paymentLink: { select: { id: true, title: true, purpose: true, customerName: true, customerEmail: true, customerPhone: true } },
        purchasedGiftVoucher: { select: { code: true, token: true, type: true, status: true, recipientName: true, purchaserEmail: true } },
      },
    }),
    prisma.posSale.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true }, _sum: { total: true, giftVoucherAmount: true } }),
    prisma.paymentWebhookEvent.findFirst({
      where: { provider: "XENDIT" },
      orderBy: { receivedAt: "desc" },
      select: { event: true, status: true, paymentSessionId: true, paymentReference: true, receivedAt: true },
    }),
  ])

  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows
  const last = pageRows.at(-1)
  const totals = Object.fromEntries(statusGroups.map((group) => [group.status, {
    count: group._count._all,
    total: group._sum.total || 0,
    giftVoucherAmount: group._sum.giftVoucherAmount || 0,
  }]))

  return NextResponse.json({
    sales: pageRows.map((sale) => ({ ...sale, channel: getSalesChannel(sale) })),
    totals,
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    reconciliation,
    webhook: { endpoint: "/api/payments/xendit-webhook", lastReceived: lastWebhook },
  }, { headers: { "Cache-Control": "private, no-store" } })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (isRequestBodyTooLarge(req, 8 * 1024)) return NextResponse.json({ error: "Sale update is too large" }, { status: 413 })

  const data = await req.json().catch(() => ({}))
  const saleId = cleanString(data.saleId, 100)
  if (!saleId || typeof data.fulfilled !== "boolean") return NextResponse.json({ error: "A valid sale and fulfillment state are required" }, { status: 400 })

  const existing = await prisma.posSale.findUnique({
    where: { id: saleId },
    select: { id: true, operatorId: true, paymentMethod: true, paymentReference: true, paymentSessionId: true, paymentLinkId: true, notes: true },
  })
  if (!existing || getSalesChannel(existing) !== "WEBSITE") return NextResponse.json({ error: "Website shop sale not found" }, { status: 404 })

  const sale = await prisma.posSale.update({ where: { id: saleId }, data: { fulfilledAt: data.fulfilled ? new Date() : null } })
  return NextResponse.json({ sale })
}
