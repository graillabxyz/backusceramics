import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"
import { ONLINE_SHOP_NOTE } from "@/lib/pos-sale-payment"
import { checkRateLimit, rateLimitHeaders } from "@/lib/server-security"
import { reconcileXenditWebsiteSaleById } from "@/lib/xendit-sale-reconciliation"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rateLimit = checkRateLimit(req, { key: "shop-sale-status", limit: 30, windowMs: 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many status checks. Wait a moment and try again." },
      { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) }
    )
  }

  const { id } = await params
  const sale = await prisma.posSale.findFirst({
    where: {
      id,
      notes: { startsWith: ONLINE_SHOP_NOTE },
    },
    select: {
      id: true,
      receiptEmail: true,
      status: true,
    },
  })
  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 })

  const sessionEmail = session.user.email?.trim().toLowerCase() || ""
  const saleEmail = sale.receiptEmail?.trim().toLowerCase() || ""
  if (!isFullAdminRole(session.user.role) && (!sessionEmail || sessionEmail !== saleEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let reconciliation = { checked: 0, updated: 0, failed: 0, status: null as string | null }
  if (sale.status === "PENDING_PAYMENT") {
    try {
      reconciliation = await reconcileXenditWebsiteSaleById(sale.id)
    } catch (error) {
      console.error("Could not check website sale status with Xendit", { error, saleId: sale.id })
      reconciliation = { checked: 1, updated: 0, failed: 1, status: null }
    }
  }

  const updatedSale = await prisma.posSale.findUnique({
    where: { id: sale.id },
    select: {
      id: true,
      status: true,
      total: true,
      currency: true,
      fulfillmentMethod: true,
      shippingAmount: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ sale: updatedSale, reconciliation })
}
