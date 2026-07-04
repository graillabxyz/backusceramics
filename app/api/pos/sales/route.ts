import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { POS_PAYMENT_METHODS } from "@/lib/pos-catalog"
import { calculatePosLineTotals, normalizePosDiscountType, normalizePosTaxRate } from "@/lib/pos-sale-calculations"
import { sendPosReceiptEmail } from "@/lib/pos-receipts"
import { recordAnalyticsEvent } from "@/lib/analytics-server"
import { notifyCupSalePaid } from "@/lib/admin-notification-events"

interface SaleItemRequest {
  productId: string
  quantity: number
  taxRate: ReturnType<typeof normalizePosTaxRate>
  discountType: ReturnType<typeof normalizePosDiscountType>
  discountValue: number
}

interface RawSaleItemRequest {
  productId?: unknown
  quantity?: unknown
  taxRate?: unknown
  discountType?: unknown
  discountValue?: unknown
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await req.json()
  const items = Array.isArray(data.items) ? data.items : []
  const paymentMethod = data.paymentMethod || "CARD_MACHINE"
  const receiptEmail = typeof data.receiptEmail === "string" ? data.receiptEmail.trim() : ""

  if (!POS_PAYMENT_METHODS.includes(paymentMethod)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })
  }

  const saleItems: SaleItemRequest[] = items.map((item: RawSaleItemRequest) => ({
    productId: String(item.productId || ""),
    quantity: Number(item.quantity || 0),
    taxRate: normalizePosTaxRate(item.taxRate),
    discountType: normalizePosDiscountType(item.discountType),
    discountValue: Number(item.discountValue || 0),
  }))

  if (saleItems.length === 0 || saleItems.some((item) => !item.productId || !Number.isInteger(item.quantity) || item.quantity < 1)) {
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
        const product = await tx.posProduct.findUnique({ where: { id: item.productId } })
        if (!product || product.status !== "AVAILABLE") {
          throw new Error(`${product?.name || "Product"} is not available`)
        }
        if (product.price <= 0) {
          throw new Error(`${product.name} needs a price before it can be sold`)
        }
        if (product.quantity < item.quantity) {
          throw new Error(`Only ${product.quantity} ${product.name} available`)
        }

        const updated = await tx.posProduct.updateMany({
          where: {
            id: item.productId,
            status: "AVAILABLE",
            quantity: { gte: item.quantity },
          },
          data: {
            quantity: { decrement: item.quantity },
          },
        })

        if (updated.count !== 1) {
          throw new Error(`${product.name} changed while completing the sale`)
        }

        const remaining = product.quantity - item.quantity
        if (remaining === 0) {
          await tx.posProduct.update({
            where: { id: item.productId },
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
          operatorId: session.user.id,
          subtotal,
          discountTotal,
          taxTotal,
          total,
          status: "PAID",
          paymentMethod,
          receiptEmail: receiptEmail || null,
          notes: data.notes ? String(data.notes).trim() : null,
          items: {
            create: snapshots,
          },
        },
        include: { items: true },
      })
    })

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
      { error: error instanceof Error ? error.message : "Sale could not be completed" },
      { status: 409 }
    )
  }
}
