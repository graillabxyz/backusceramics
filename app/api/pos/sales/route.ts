import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { POS_PAYMENT_METHODS } from "@/lib/pos-catalog"
import { calculatePosLineTotals, normalizePosDiscountType, normalizePosTaxRate } from "@/lib/pos-sale-calculations"
import { sendPosReceiptEmail } from "@/lib/pos-receipts"
import { recordAnalyticsEvent } from "@/lib/analytics-server"
import { notifyCupSalePaid } from "@/lib/admin-notification-events"
import { checkRateLimit, cleanString, isRequestBodyTooLarge, isValidEmailAddress, rateLimitHeaders, safeHeaderValue } from "@/lib/server-security"
import { getPosOperatorFromRequest } from "@/lib/pos-operator-session"

const MAX_POS_SALE_BODY_BYTES = 64 * 1024

interface SaleItemRequest {
  productId: string | null
  quantity: number
  taxRate: ReturnType<typeof normalizePosTaxRate>
  discountType: ReturnType<typeof normalizePosDiscountType>
  discountValue: number
  customItemType: "DISCOUNT_BOX" | null
  customName: string
  customUnitPrice: number
}

interface RawSaleItemRequest {
  productId?: unknown
  quantity?: unknown
  taxRate?: unknown
  discountType?: unknown
  discountValue?: unknown
  customItemType?: unknown
  customName?: unknown
  customUnitPrice?: unknown
}

class PosSaleValidationError extends Error {}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const posOperator = await getPosOperatorFromRequest(req)
  if (!posOperator) {
    return NextResponse.json({ error: "Unlock the POS with a cashier PIN to view sales.", code: "POS_PIN_LOCKED" }, { status: 423 })
  }

  const limitParam = Number(req.nextUrl.searchParams.get("limit") || 100)
  const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 100
  const status = req.nextUrl.searchParams.get("status")
  const allowedStatuses = new Set(["PAID", "PENDING_PAYMENT", "CANCELLED", "VOIDED"])
  if (status && status !== "ALL" && !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "Invalid sale status" }, { status: 400 })
  }
  const where = status && status !== "ALL" ? { status } : undefined

  const sales = await prisma.posSale.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      items: true,
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      voidedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return NextResponse.json(sales)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const posOperator = await getPosOperatorFromRequest(req)
  if (!posOperator) {
    return NextResponse.json(
      { error: "Unlock the POS with a cashier PIN before recording a sale.", code: "POS_PIN_LOCKED" },
      { status: 423 }
    )
  }

  const rateLimit = checkRateLimit(req, { key: "pos-sale", limit: 60, windowMs: 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many sale attempts. Wait a moment and try again." }, { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) })
  }

  if (isRequestBodyTooLarge(req, MAX_POS_SALE_BODY_BYTES)) {
    return NextResponse.json({ error: "Sale payload is too large" }, { status: 413 })
  }

  const data = await req.json().catch(() => null)
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Sale request is not valid JSON" }, { status: 400 })
  const items = Array.isArray(data.items) ? data.items : []
  const paymentMethod = data.paymentMethod || "CARD_MACHINE"
  const receiptEmail = typeof data.receiptEmail === "string" ? safeHeaderValue(data.receiptEmail, 254) : ""
  if (receiptEmail && !isValidEmailAddress(receiptEmail)) {
    return NextResponse.json({ error: "Enter a valid receipt email" }, { status: 400 })
  }

  if (!POS_PAYMENT_METHODS.includes(paymentMethod)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })
  }

  const saleItems: SaleItemRequest[] = items.map((item: RawSaleItemRequest) => ({
    productId: typeof item.productId === "string" && item.productId ? item.productId : null,
    quantity: Number(item.quantity || 0),
    taxRate: normalizePosTaxRate(item.taxRate),
    discountType: normalizePosDiscountType(item.discountType),
    discountValue: Number(item.discountValue || 0),
    customItemType: item.customItemType === "DISCOUNT_BOX" ? "DISCOUNT_BOX" : null,
    customName: cleanString(item.customName, 160) || "Discount box ceramic",
    customUnitPrice: Number(item.customUnitPrice || 0),
  }))

  if (saleItems.length === 0 || saleItems.length > 100 || saleItems.some((item) => (
    !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 ||
    (!item.productId && item.customItemType !== "DISCOUNT_BOX") ||
    (item.customItemType === "DISCOUNT_BOX" && (!Number.isInteger(item.customUnitPrice) || item.customUnitPrice < 1 || item.customUnitPrice > 100_000_000))
  ))) {
    return NextResponse.json({ error: "Sale needs at least one valid item" }, { status: 400 })
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const snapshots = []
      let subtotal = 0
      let discountTotal = 0
      let taxTotal = 0
      let total = 0

      for (const item of saleItems) {
        if (item.customItemType === "DISCOUNT_BOX") {
          const lineTotals = calculatePosLineTotals({
            unitPrice: item.customUnitPrice,
            quantity: item.quantity,
            taxRate: item.taxRate,
            discountType: item.discountType,
            discountValue: item.discountValue,
          })
          subtotal += lineTotals.subtotal
          discountTotal += lineTotals.discountAmount
          taxTotal += lineTotals.taxAmount
          total += lineTotals.total
          snapshots.push({
            productId: null,
            nameSnapshot: item.customName,
            skuSnapshot: "DISCOUNT-BOX",
            categorySnapshot: "OTHER",
            unitPrice: item.customUnitPrice,
            quantity: item.quantity,
            subtotal: lineTotals.subtotal,
            discountAmount: lineTotals.discountAmount,
            taxRate: lineTotals.taxRate,
            taxAmount: lineTotals.taxAmount,
            lineTotal: lineTotals.total,
          })
          continue
        }

        const productId = item.productId
        if (!productId) throw new PosSaleValidationError("Sale item is missing its product")
        const product = await tx.posProduct.findUnique({ where: { id: productId } })
        if (!product || product.status !== "AVAILABLE") {
          throw new PosSaleValidationError(`${product?.name || "Product"} is not available`)
        }
        if (product.price <= 0) {
          throw new PosSaleValidationError(`${product.name} needs a price before it can be sold`)
        }
        if (product.quantity < item.quantity) {
          throw new PosSaleValidationError(`Only ${product.quantity} ${product.name} available`)
        }

        const updated = await tx.posProduct.updateMany({
          where: {
            id: productId,
            status: "AVAILABLE",
            quantity: { gte: item.quantity },
          },
          data: {
            quantity: { decrement: item.quantity },
          },
        })

        if (updated.count !== 1) {
          throw new PosSaleValidationError(`${product.name} changed while completing the sale`)
        }

        const remaining = product.quantity - item.quantity
        if (remaining === 0) {
          await tx.posProduct.update({
            where: { id: productId },
            data: { status: "SOLD", showInShop: false, featured: false },
          })
        }

        const lineTotals = calculatePosLineTotals({
          unitPrice: product.price,
          quantity: item.quantity,
          taxRate: item.taxRate,
          discountType: item.discountType,
          discountValue: item.discountValue,
        })
        subtotal += lineTotals.subtotal
        discountTotal += lineTotals.discountAmount
        taxTotal += lineTotals.taxAmount
        total += lineTotals.total
        snapshots.push({
          productId: product.id,
          nameSnapshot: product.name,
          skuSnapshot: product.sku,
          categorySnapshot: product.category,
          unitPrice: product.price,
          quantity: item.quantity,
          subtotal: lineTotals.subtotal,
          discountAmount: lineTotals.discountAmount,
          taxRate: lineTotals.taxRate,
          taxAmount: lineTotals.taxAmount,
          lineTotal: lineTotals.total,
        })
      }

      return tx.posSale.create({
        data: {
          operatorId: posOperator.id,
          subtotal,
          discountTotal,
          taxTotal,
          total,
          status: "PAID",
          paymentMethod,
          receiptEmail: receiptEmail || null,
          notes: data.notes ? cleanString(data.notes, 1000) : null,
          items: {
            create: snapshots,
          },
        },
        include: { items: true },
      })
    })

    revalidatePath("/wall-of-cups")

    if (receiptEmail) {
      const sent = await sendPosReceiptEmail(sale)
      if (sent) {
        await prisma.posSale.update({
          where: { id: sale.id },
          data: { receiptSentAt: new Date() },
        })
      }
    }

    await recordAnalyticsEvent({
      type: "pos_sale_paid",
      userId: session.user.id,
      source: "pos",
      value: sale.total,
      currency: sale.currency,
      metadata: {
        saleId: sale.id,
        paymentMethod,
        itemCount: sale.items.length,
        receiptRequested: Boolean(receiptEmail),
      },
    }, req)

    await notifyCupSalePaid(sale, paymentMethod === "CARD_MACHINE" ? "card machine" : paymentMethod.toLowerCase())

    return NextResponse.json(sale, { status: 201 })
  } catch (error) {
    console.error("Could not complete POS sale", { error })
    return NextResponse.json(
      { error: error instanceof PosSaleValidationError ? error.message : "Sale could not be completed. Please try again." },
      { status: error instanceof PosSaleValidationError ? 409 : 500 }
    )
  }
}
