import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { getXenditCallbackToken } from "@/lib/xendit"
import { sendPosReceiptEmail } from "@/lib/pos-receipts"
import { recordAnalyticsEvent } from "@/lib/analytics-server"
import { notifyClassBookingsConfirmed, notifyCupSalePaid } from "@/lib/admin-notification-events"
import { isRequestBodyTooLarge } from "@/lib/server-security"
import {
  extractBookingIds,
  getWebhookPaymentSessionId,
  getWebhookPosReference,
  getWebhookPosSaleId,
  getWebhookReference,
  getWebhookStatus,
  hasExplicitPosIdentity,
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

async function cancelPendingPosSale(sale: Awaited<ReturnType<typeof findPosSaleForWebhook>>) {

  if (!sale || sale.status !== "PENDING_PAYMENT") return { updated: 0 }
  const shouldRestoreShopVisibility = Boolean(sale.notes?.includes("[online-shop]"))

  await prisma.$transaction([
    ...sale.items
      .filter((item) => item.productId)
      .map((item) =>
        prisma.posProduct.update({
          where: { id: item.productId! },
          data: {
            quantity: { increment: item.quantity },
            status: "AVAILABLE",
            ...(shouldRestoreShopVisibility ? { showInShop: true } : {}),
          },
        })
      ),
    prisma.posSale.update({
      where: { id: sale.id },
      data: { status: "CANCELLED" },
    }),
  ])

  return { updated: 1 }
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
      const result = await cancelPendingPosSale(sale)
      if (result.updated) revalidatePath("/wall-of-cups")
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
      const claimed = await prisma.posSale.updateMany({
        where: { id: sale.id, status: "PENDING_PAYMENT" },
        data: { status: "PAID" },
      })

      if (claimed.count === 0) {
        return NextResponse.json({ ok: true, status: posSaleStatus, posUpdated: 0, ignored: true })
      }

      const updatedSale = await prisma.posSale.findUnique({
        where: { id: sale.id },
        include: { items: true },
      })

      if (!updatedSale) {
        console.error("POS sale disappeared after payment status update", { saleId: sale.id })
        return NextResponse.json({ ok: true, status: posSaleStatus, posUpdated: 0 })
      }

      if (updatedSale.receiptEmail && !updatedSale.receiptSentAt) {
        const sent = await sendPosReceiptEmail(updatedSale)
        if (sent) {
          await prisma.posSale.update({
            where: { id: updatedSale.id },
            data: { receiptSentAt: new Date() },
          })
        }
      }

      await recordAnalyticsEvent({
        type: "pos_payment_completed",
        source: "xendit_webhook",
        value: updatedSale.total,
        currency: updatedSale.currency,
        metadata: {
          posSaleId: updatedSale.id,
          paymentSessionId,
          paymentReference: posReference || undefined,
          itemCount: updatedSale.items.length,
          webhookStatus,
        },
      }, req)

      await notifyCupSalePaid(updatedSale, "online POS payment")

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
