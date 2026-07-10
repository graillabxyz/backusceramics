import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { formatPrice } from "@/lib/pos-catalog"
import { calculatePosLineTotals, normalizePosDiscountType, normalizePosTaxRate } from "@/lib/pos-sale-calculations"
import {
  createXenditPaymentSession,
  XenditApiError,
  XenditConfigurationError,
} from "@/lib/xendit"
import { recordAnalyticsEvent } from "@/lib/analytics-server"
import { cleanString, isRequestBodyTooLarge, safeHeaderValue } from "@/lib/server-security"
import { getPosOperatorFromRequest } from "@/lib/pos-operator-session"

const MAX_POS_ONLINE_SALE_BODY_BYTES = 64 * 1024

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

function sanitizeReference(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "pos_sale"
}

function sanitizeCustomerName(value?: string | null) {
  return (value || "BackusCustomer").replace(/[^a-zA-Z0-9]/g, "").slice(0, 50) || "BackusCustomer"
}

function getOrigin(req: NextRequest) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "")
  const requestOrigin = (req.headers.get("origin") || req.nextUrl.origin).replace(/\/$/, "")
  return configuredSiteUrl?.startsWith("https://") ? configuredSiteUrl : requestOrigin
}

async function restorePendingSaleInventory(saleId: string) {
  const sale = await prisma.posSale.findUnique({
    where: { id: saleId },
    include: { items: true },
  })

  if (!sale) return

  await prisma.$transaction([
    ...sale.items
      .filter((item) => item.productId)
      .map((item) =>
        prisma.posProduct.update({
          where: { id: item.productId! },
          data: {
            quantity: { increment: item.quantity },
            status: "AVAILABLE",
          },
        })
      ),
    prisma.posSale.update({
      where: { id: saleId },
      data: { status: "CANCELLED" },
    }),
  ])
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const posOperator = await getPosOperatorFromRequest(req)
  if (!posOperator) {
    return NextResponse.json(
      { error: "Unlock the POS with a cashier PIN before starting online payment.", code: "POS_PIN_LOCKED" },
      { status: 423 }
    )
  }

  if (isRequestBodyTooLarge(req, MAX_POS_ONLINE_SALE_BODY_BYTES)) {
    return NextResponse.json({ error: "Sale payload is too large" }, { status: 413 })
  }

  const data = await req.json()
  const items = Array.isArray(data.items) ? data.items : []
  const receiptEmail = typeof data.receiptEmail === "string" ? safeHeaderValue(data.receiptEmail, 254) : ""
  const customerName = typeof data.customerName === "string" ? cleanString(data.customerName, 160) : ""
  const saleItems: SaleItemRequest[] = items.map((item: RawSaleItemRequest) => ({
    productId: String(item.productId || ""),
    quantity: Number(item.quantity || 0),
    taxRate: normalizePosTaxRate(item.taxRate),
    discountType: normalizePosDiscountType(item.discountType),
    discountValue: Number(item.discountValue || 0),
  }))

  if (saleItems.length === 0 || saleItems.some((item) => !item.productId || !Number.isInteger(item.quantity) || item.quantity < 1)) {
    return NextResponse.json({ error: "Online payment needs at least one valid item" }, { status: 400 })
  }

  const paymentReference = sanitizeReference(`pos_${Date.now()}`)
  let createdSaleId = ""

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

        if (updated.count !== 1) throw new Error(`${product.name} changed while starting payment`)

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
          operatorId: posOperator.id,
          subtotal,
          discountTotal,
          taxTotal,
          total,
          status: "PENDING_PAYMENT",
          paymentMethod: "ONLINE",
          paymentReference,
          receiptEmail: receiptEmail || null,
          notes: data.notes ? cleanString(data.notes, 1000) : null,
          items: { create: snapshots },
        },
        include: { items: true },
      })
    })

    createdSaleId = sale.id
    const origin = getOrigin(req)
    const paymentSession = await createXenditPaymentSession({
      reference_id: paymentReference,
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount: sale.total,
      currency: "IDR",
      country: "ID",
      description: `Backus Ceramics POS sale ${sale.id} - ${formatPrice(sale.total)}`,
      allow_save_payment_method: "DISABLED",
      locale: "en",
      customer: {
        reference_id: receiptEmail || sale.id,
        type: "INDIVIDUAL",
        email: receiptEmail || undefined,
        individual_detail: {
          given_names: sanitizeCustomerName(customerName || receiptEmail || "BackusCustomer"),
        },
      },
      items: sale.items.map((item) => ({
        reference_id: item.productId || item.id,
        type: "PHYSICAL_PRODUCT",
        name: item.quantity > 1 ? `${item.nameSnapshot} x ${item.quantity}` : item.nameSnapshot,
        net_unit_amount: Math.max(item.lineTotal, 0),
        quantity: 1,
        category: item.categorySnapshot,
      })),
      metadata: {
        pos_sale_id: sale.id,
        pos_payment_reference: paymentReference,
        receipt_email: receiptEmail || undefined,
      },
      success_return_url: `${origin}/admin/pos?posPayment=success&sale=${sale.id}`,
      cancel_return_url: `${origin}/admin/pos?posPayment=cancelled&sale=${sale.id}`,
    })

    const updatedSale = await prisma.posSale.update({
      where: { id: sale.id },
      data: { paymentSessionId: paymentSession.payment_session_id },
      include: { items: true },
    })

    await recordAnalyticsEvent({
      type: "pos_online_payment_started",
      userId: session.user.id,
      source: "pos",
      value: updatedSale.total,
      currency: updatedSale.currency,
      metadata: {
        saleId: updatedSale.id,
        paymentReference,
        paymentSessionId: paymentSession.payment_session_id,
        itemCount: updatedSale.items.length,
        receiptRequested: Boolean(receiptEmail),
      },
    }, req)

    return NextResponse.json({
      sale: updatedSale,
      paymentUrl: paymentSession.payment_link_url,
    }, { status: 201 })
  } catch (error) {
    if (createdSaleId) {
      try {
        await restorePendingSaleInventory(createdSaleId)
      } catch (restoreError) {
        console.error("Could not restore POS inventory after online payment failure", { restoreError, createdSaleId })
      }
    }

    const isXenditError = error instanceof XenditApiError
    const isConfigError = error instanceof XenditConfigurationError
    console.error("Could not start POS online payment", {
      error,
      xenditStatus: isXenditError ? error.status : undefined,
      xenditCode: isXenditError ? error.xenditCode : undefined,
    })

    return NextResponse.json(
      {
        error: isConfigError
          ? "Online payment is not configured yet."
          : error instanceof Error
            ? error.message
            : "Online payment could not be started.",
      },
      { status: isConfigError ? 503 : 409 }
    )
  }
}
