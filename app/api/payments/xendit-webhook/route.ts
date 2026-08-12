import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { getXenditCallbackToken } from "@/lib/xendit"
import { recordAnalyticsEvent } from "@/lib/analytics-server"
import { notifyClassBookingsConfirmed } from "@/lib/admin-notification-events"
import { cancelPendingPosSalePayment, completePendingPosSalePayment } from "@/lib/pos-sale-payment"
import { isRequestBodyTooLarge } from "@/lib/server-security"
import { settlePromoRedemption } from "@/lib/promo-codes"
import {
  extractBookingIds,
  getWebhookAmount,
  getWebhookCurrency,
  getWebhookPaymentSessionId,
  getWebhookPosReference,
  getWebhookPosSaleId,
  getWebhookReference,
  getWebhookStatus,
  hasExplicitPosIdentity,
  isMatchingWebhookPaymentTotal,
  mapInvoiceStatusToBookingStatus,
  mapInvoiceStatusToPosSaleStatus,
  type XenditWebhookPayload,
} from "@/lib/xendit-webhook"

export const runtime = "nodejs"

const MAX_WEBHOOK_BODY_BYTES = 128 * 1024

function hasValidCallbackToken(incomingToken: string | null, callbackToken: string) {
  if (!incomingToken) return false

  const incoming = Buffer.from(incomingToken)
  const expected = Buffer.from(callbackToken)
  if (incoming.length !== expected.length) return false

  return timingSafeEqual(incoming, expected)
}

async function findPosSaleForWebhook({
  posSaleId,
  paymentSessionId,
  posReference,
}: {
  posSaleId?: string
  paymentSessionId?: string
  posReference?: string
}) {
  const sale = await prisma.posSale.findFirst({
    include: { items: true },
    where: {
      OR: [
        ...(posSaleId ? [{ id: posSaleId }] : []),
        ...(paymentSessionId ? [{ paymentSessionId }] : []),
        ...(posReference ? [{ paymentReference: posReference }] : []),
      ],
    },
  })

  return sale
}

export async function POST(req: NextRequest) {
  const callbackToken = getXenditCallbackToken()
  if (!callbackToken) {
    console.error("Received Xendit webhook but XENDIT_CALLBACK_TOKEN is not configured")
    return NextResponse.json({ error: "Webhook token is not configured" }, { status: 503 })
  }

  const incomingToken = req.headers.get("x-callback-token")
  if (!hasValidCallbackToken(incomingToken, callbackToken)) {
    return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 })
  }

  if (isRequestBodyTooLarge(req, MAX_WEBHOOK_BODY_BYTES)) {
    return NextResponse.json({ error: "Webhook payload is too large" }, { status: 413 })
  }

  let payload: XenditWebhookPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid webhook JSON" }, { status: 400 })
  }

  const webhookStatus = getWebhookStatus(payload)
  const posSaleStatus = mapInvoiceStatusToPosSaleStatus(webhookStatus)
  const posSaleId = getWebhookPosSaleId(payload)
  const posReference = getWebhookPosReference(payload)
  const paymentSessionId = getWebhookPaymentSessionId(payload)
  const explicitPosIdentity = hasExplicitPosIdentity(payload)

  try {
    await prisma.paymentWebhookEvent.create({
      data: {
        event: payload.event || payload.type || null,
        status: webhookStatus || null,
        paymentSessionId: paymentSessionId || null,
        paymentReference: posReference || getWebhookReference(payload) || null,
        saleId: posSaleId || null,
      },
    })
  } catch (error) {
    console.error("Could not record verified Xendit webhook receipt", { error })
  }

  console.info("Received verified Xendit webhook", {
    event: payload.event || payload.type || null,
    status: webhookStatus || null,
    paymentSessionId: paymentSessionId || null,
    reference: posReference || null,
    hasBookingIds: extractBookingIds(payload).length > 0,
    explicitPosIdentity,
  })

  if (posSaleStatus && (explicitPosIdentity || paymentSessionId)) {
    const sale = await findPosSaleForWebhook({ posSaleId, paymentSessionId, posReference })

    if (sale && posSaleStatus === "CANCELLED") {
      const result = await cancelPendingPosSalePayment(sale.id)
      await settlePromoRedemption({
        paymentReference: sale.paymentReference || posReference,
        paymentSessionId: sale.paymentSessionId || paymentSessionId,
        status: "CANCELLED",
      })
      await recordAnalyticsEvent({
        type: "pos_payment_cancelled",
        source: "xendit_webhook",
        value: sale?.total || null,
        metadata: {
          posSaleId: sale?.id || posSaleId || undefined,
          paymentSessionId,
          paymentReference: posReference || undefined,
          updated: result.updated,
          webhookStatus,
        },
      }, req)
      return NextResponse.json({ ok: true, status: posSaleStatus, posUpdated: result.updated })
    }

    if (!sale && explicitPosIdentity) {
      console.error("Received POS payment webhook without matching sale", {
        posSaleId,
        paymentSessionId,
        posReference,
        status: webhookStatus,
      })
      return NextResponse.json({ ok: true, posUpdated: 0 })
    }

    if (sale) {
      if (posSaleStatus === "PAID" && !isMatchingWebhookPaymentTotal(payload, sale.total, sale.currency)) {
        console.error("Rejected Xendit payment webhook with mismatched sale total", {
          saleId: sale.id,
          expectedAmount: sale.total,
          expectedCurrency: sale.currency,
          webhookAmount: getWebhookAmount(payload),
          webhookCurrency: getWebhookCurrency(payload) || null,
          paymentSessionId,
          posReference,
        })
        return NextResponse.json(
          { error: "Payment amount does not match the sale total." },
          { status: 409 }
        )
      }

      const result = await completePendingPosSalePayment(sale.id, "xendit_webhook", req)
      if (result.updated === 0) {
        return NextResponse.json({ ok: true, status: posSaleStatus, posUpdated: 0, ignored: true })
      }

      const updatedSale = result.sale
      if (!updatedSale) {
        console.error("POS sale disappeared after payment status update", { saleId: sale.id })
        return NextResponse.json({ ok: true, status: posSaleStatus, posUpdated: 0 })
      }

      await settlePromoRedemption({
        paymentReference: updatedSale.paymentReference || posReference,
        paymentSessionId: updatedSale.paymentSessionId || paymentSessionId,
        status: "APPLIED",
      })

      return NextResponse.json({ ok: true, status: posSaleStatus, posUpdated: 1 })
    }
  }

  const bookingStatus = mapInvoiceStatusToBookingStatus(webhookStatus)
  if (!bookingStatus) {
    return NextResponse.json({ ok: true, ignored: true, status: webhookStatus || null })
  }

  const bookingIds = extractBookingIds(payload)
  const externalId = getWebhookReference(payload)
  const where = bookingIds.length > 0
    ? { id: { in: bookingIds } }
    : paymentSessionId
      ? { paymentSessionId }
      : externalId
        ? { paymentReference: externalId }
        : null

  if (!where) {
    console.error("Received Xendit webhook without booking ids or reference", {
      externalId,
      status: webhookStatus,
    })
    return NextResponse.json({ ok: true, updated: 0 })
  }

  const pendingWhere = { ...where, status: "PENDING" }
  const result = await prisma.classBooking.updateMany({
    where: pendingWhere,
    data: {
      status: bookingStatus,
      holdExpiresAt: null,
      ...(bookingStatus === "CONFIRMED" ? { confirmedAt: new Date() } : { cancelledAt: new Date() }),
    },
  })
  await settlePromoRedemption({
    paymentReference: externalId,
    paymentSessionId,
    status: bookingStatus === "CONFIRMED" ? "APPLIED" : "CANCELLED",
  })

  if (result.count === 0) {
    console.warn("Verified Xendit class webhook matched no pending bookings", {
      bookingIds,
      externalId,
      paymentSessionId,
      webhookStatus,
    })
  }

  await recordAnalyticsEvent({
    type: bookingStatus === "CONFIRMED" ? "payment_completed" : "payment_cancelled",
    source: "xendit_webhook",
    metadata: {
      bookingStatus,
      webhookStatus,
      bookingIds,
      externalId,
      paymentSessionId,
      updated: result.count,
    },
  }, req)

  if (bookingStatus === "CONFIRMED" && result.count > 0) {
    const confirmedBookings = await prisma.classBooking.findMany({
      where: { ...where, status: "CONFIRMED" },
      orderBy: { createdAt: "asc" },
      take: 20,
    })
    await notifyClassBookingsConfirmed(confirmedBookings)
  }

  return NextResponse.json({
    ok: true,
    status: bookingStatus,
    updated: result.count,
  })
}
