import { prisma } from "@/lib/prisma"
import { recordAnalyticsEvent } from "@/lib/analytics-server"
import { completePendingPosSalePayment, cancelPendingPosSalePayment, ONLINE_SHOP_NOTE } from "@/lib/pos-sale-payment"
import { getXenditPaymentSession } from "@/lib/xendit"
import { mapInvoiceStatusToPosSaleStatus } from "@/lib/xendit-webhook"

const RECONCILIATION_LOOKBACK_DAYS = 30

export function isMatchingXenditSalePayment({
  paymentSessionId,
  paymentReference,
  expectedAmount,
  expectedCurrency,
  remotePaymentSessionId,
  remoteReference,
  remoteAmount,
  remoteCurrency,
  remoteSessionType,
}: {
  paymentSessionId: string
  paymentReference: string
  expectedAmount: number
  expectedCurrency: string
  remotePaymentSessionId: string
  remoteReference: string
  remoteAmount?: number
  remoteCurrency?: string
  remoteSessionType?: string
}) {
  return (
    remotePaymentSessionId === paymentSessionId &&
    remoteReference === paymentReference &&
    Number.isSafeInteger(remoteAmount) &&
    remoteAmount === expectedAmount &&
    remoteCurrency?.toUpperCase() === expectedCurrency.toUpperCase() &&
    remoteSessionType?.toUpperCase() === "PAY"
  )
}

async function reconcileSale(sale: {
  id: string
  total: number
  currency: string
  paymentReference: string | null
  paymentSessionId: string | null
}) {
  if (!sale.paymentSessionId || !sale.paymentReference) {
    return { checked: 0, updated: 0, failed: 0, status: null }
  }

  const remoteSession = await getXenditPaymentSession(sale.paymentSessionId)
  const isMatch = isMatchingXenditSalePayment({
    paymentSessionId: sale.paymentSessionId,
    paymentReference: sale.paymentReference,
    expectedAmount: sale.total,
    expectedCurrency: sale.currency,
    remotePaymentSessionId: remoteSession.payment_session_id,
    remoteReference: remoteSession.reference_id,
    remoteAmount: remoteSession.amount,
    remoteCurrency: remoteSession.currency,
    remoteSessionType: remoteSession.session_type,
  })

  if (!isMatch) {
    console.error("Xendit website sale reconciliation rejected mismatched session details", {
      saleId: sale.id,
      paymentSessionId: sale.paymentSessionId,
      paymentReference: sale.paymentReference,
      expectedAmount: sale.total,
      expectedCurrency: sale.currency,
      remotePaymentSessionId: remoteSession.payment_session_id,
      remoteReference: remoteSession.reference_id,
      remoteAmount: remoteSession.amount,
      remoteCurrency: remoteSession.currency,
      remoteSessionType: remoteSession.session_type,
    })
    return { checked: 1, updated: 0, failed: 1, status: remoteSession.status || null }
  }

  const saleStatus = mapInvoiceStatusToPosSaleStatus(remoteSession.status)
  if (!saleStatus) return { checked: 1, updated: 0, failed: 0, status: remoteSession.status || null }

  if (saleStatus === "PAID") {
    const result = await completePendingPosSalePayment(sale.id, "xendit_status_reconciliation")
    return { checked: 1, updated: result.updated, failed: 0, status: saleStatus }
  }

  const result = await cancelPendingPosSalePayment(sale.id)
  if (result.updated) {
    await recordAnalyticsEvent({
      type: "pos_payment_cancelled",
      source: "xendit_status_reconciliation",
      value: sale.total,
      currency: sale.currency,
      metadata: {
        posSaleId: sale.id,
        paymentSessionId: sale.paymentSessionId,
        paymentReference: sale.paymentReference,
        remoteStatus: remoteSession.status,
      },
    })
  }
  return { checked: 1, updated: result.updated, failed: 0, status: saleStatus }
}

export async function reconcileXenditWebsiteSaleById(saleId: string) {
  const sale = await prisma.posSale.findFirst({
    where: {
      id: saleId,
      status: "PENDING_PAYMENT",
      notes: { startsWith: ONLINE_SHOP_NOTE },
    },
    select: {
      id: true,
      total: true,
      currency: true,
      paymentReference: true,
      paymentSessionId: true,
    },
  })

  if (!sale) return { checked: 0, updated: 0, failed: 0, status: null }
  return reconcileSale(sale)
}

export async function reconcileRecentXenditWebsiteSales(maxSessions = 10) {
  const recentCutoff = new Date(Date.now() - RECONCILIATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const candidates = await prisma.posSale.findMany({
    where: {
      status: "PENDING_PAYMENT",
      notes: { startsWith: ONLINE_SHOP_NOTE },
      paymentSessionId: { not: null },
      paymentReference: { not: null },
      createdAt: { gte: recentCutoff },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(maxSessions, 1), 20),
    select: {
      id: true,
      total: true,
      currency: true,
      paymentReference: true,
      paymentSessionId: true,
    },
  })

  const outcomes = await Promise.all(candidates.map(async (sale) => {
    try {
      return await reconcileSale(sale)
    } catch (error) {
      console.error("Could not reconcile pending website sale with Xendit", {
        error,
        saleId: sale.id,
        paymentSessionId: sale.paymentSessionId,
        paymentReference: sale.paymentReference,
      })
      return { checked: 1, updated: 0, failed: 1, status: null }
    }
  }))

  return outcomes.reduce(
    (summary, outcome) => ({
      checked: summary.checked + outcome.checked,
      updated: summary.updated + outcome.updated,
      failed: summary.failed + outcome.failed,
    }),
    { checked: 0, updated: 0, failed: 0 }
  )
}
