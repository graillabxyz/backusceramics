import type { NextRequest } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { recordAnalyticsEvent } from "@/lib/analytics-server"
import { notifyCupSalePaid, notifyWebsiteSalePaid } from "@/lib/admin-notification-events"
import { sendPosReceiptEmail } from "@/lib/pos-receipts"
import { settlePromoRedemption } from "@/lib/promo-codes"

export const ONLINE_SHOP_NOTE = "[online-shop]"

export function isOnlineShopSale(notes: string | null | undefined) {
  return Boolean(notes?.includes(ONLINE_SHOP_NOTE))
}

export async function completePendingPosSalePayment(
  saleId: string,
  source: string,
  req?: NextRequest
) {
  const claimed = await prisma.posSale.updateMany({
    where: { id: saleId, status: "PENDING_PAYMENT" },
    data: { status: "PAID" },
  })

  if (claimed.count === 0) {
    const existing = await prisma.posSale.findUnique({
      where: { id: saleId },
      include: { items: true },
    })
    return { updated: 0, sale: existing }
  }

  const sale = await prisma.posSale.findUnique({
    where: { id: saleId },
    include: { items: true },
  })
  if (!sale) throw new Error(`Paid sale ${saleId} could not be reloaded.`)
  await settlePromoRedemption({
    paymentReference: sale.paymentReference,
    paymentSessionId: sale.paymentSessionId,
    status: "APPLIED",
  })

  if (sale.receiptEmail && !sale.receiptSentAt) {
    try {
      const sent = await sendPosReceiptEmail(sale)
      if (sent) {
        await prisma.posSale.update({
          where: { id: sale.id },
          data: { receiptSentAt: new Date() },
        })
      }
    } catch (error) {
      console.error("Could not send paid sale receipt", { error, saleId: sale.id })
    }
  }

  const onlineShopSale = isOnlineShopSale(sale.notes)
  const sideEffects = await Promise.allSettled([
    recordAnalyticsEvent({
      type: "pos_payment_completed",
      source,
      value: sale.total,
      currency: sale.currency,
      metadata: {
        posSaleId: sale.id,
        paymentSessionId: sale.paymentSessionId,
        paymentReference: sale.paymentReference,
        itemCount: sale.items.length,
        checkoutChannel: onlineShopSale ? "online_shop" : "pos",
      },
    }, req),
    onlineShopSale
      ? notifyWebsiteSalePaid(sale)
      : notifyCupSalePaid(sale, source),
  ])

  sideEffects.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error("Paid sale follow-up failed", {
        error: result.reason,
        saleId: sale.id,
        followUp: index === 0 ? "analytics" : "notification",
      })
    }
  })

  if (onlineShopSale) {
    try {
      revalidatePath("/wall-of-cups")
      revalidatePath("/shop")
    } catch (error) {
      console.error("Could not refresh public shop pages after payment", { error, saleId: sale.id })
    }
  }

  return { updated: 1, sale }
}

export async function cancelPendingPosSalePayment(saleId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.posSale.updateMany({
      where: { id: saleId, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED" },
    })
    if (claimed.count === 0) return { updated: 0, sale: null }

    const sale = await tx.posSale.findUnique({
      where: { id: saleId },
      include: { items: true },
    })
    if (!sale) throw new Error(`Cancelled sale ${saleId} could not be reloaded.`)

    const restoreShopVisibility = isOnlineShopSale(sale.notes)
    for (const item of sale.items) {
      if (!item.productId) continue
      await tx.posProduct.update({
        where: { id: item.productId },
        data: {
          quantity: { increment: item.quantity },
          status: "AVAILABLE",
          ...(restoreShopVisibility ? { showInShop: true } : {}),
        },
      })
    }

    return { updated: 1, sale }
  })

  if (result.updated && isOnlineShopSale(result.sale?.notes)) {
    await settlePromoRedemption({
      paymentReference: result.sale?.paymentReference,
      paymentSessionId: result.sale?.paymentSessionId,
      status: "CANCELLED",
    })
    revalidatePath("/wall-of-cups")
    revalidatePath("/shop")
  }

  return result
}
