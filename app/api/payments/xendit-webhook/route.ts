import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { getXenditCallbackToken } from "@/lib/xendit"
import { sendPosReceiptEmail } from "@/lib/pos-receipts"
import { recordAnalyticsEvent } from "@/lib/analytics-server"
import { notifyClassBookingsConfirmed, notifyCupSalePaid } from "@/lib/admin-notification-events"
import { isRequestBodyTooLarge } from "@/lib/server-security"

export const runtime = "nodejs"

const MAX_WEBHOOK_BODY_BYTES = 128 * 1024

type XenditInvoiceWebhook = {
  event?: string
  type?: string
  external_id?: string
  reference_id?: string
  id?: string
  payment_session_id?: string
  payment_request_id?: string
  payment_token_id?: string
  status?: string
  reference?: string
  metadata?: {
    booking_ids?: string
    booking_reference?: string
    pos_sale_id?: string
    pos_payment_reference?: string
  }
  data?: {
    id?: string
    payment_session_id?: string
    payment_request_id?: string
    payment_token_id?: string
    external_id?: string
    reference_id?: string
    reference?: string
    status?: string
    metadata?: {
      booking_ids?: string
      booking_reference?: string
      pos_sale_id?: string
      pos_payment_reference?: string
    }
  }
}

function extractBookingIds(payload: XenditInvoiceWebhook) {
  const bookingIds = payload.metadata?.booking_ids || payload.data?.metadata?.booking_ids
  if (typeof bookingIds !== "string") return []

  return bookingIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

function mapInvoiceStatusToBookingStatus(status?: string) {
  const normalized = status?.toUpperCase().replace(/[\s.-]+/g, "_")
  if (normalized === "PAID" || normalized === "SETTLED" || normalized === "COMPLETED" || normalized === "SUCCEEDED" || normalized === "SUCCESS") return "CONFIRMED"
  if (normalized === "EXPIRED" || normalized === "CANCELLED" || normalized === "CANCELED") return "CANCELLED"
  return null
}

function mapInvoiceStatusToPosSaleStatus(status?: string) {
  const normalized = status?.toUpperCase().replace(/[\s.-]+/g, "_")
  if (normalized === "PAID" || normalized === "SETTLED" || normalized === "COMPLETED" || normalized === "SUCCEEDED" || normalized === "SUCCESS") return "PAID"
  if (normalized === "EXPIRED" || normalized === "CANCELLED" || normalized === "CANCELED") return "CANCELLED"
  return null
}

function getWebhookStatus(payload: XenditInvoiceWebhook) {
  const eventName = (payload.event || payload.type || "").toLowerCase().replace(/[\s.-]+/g, "_")
  if (["payment_session_completed", "payment_session_succeeded", "payment_succeeded", "invoice_paid"].includes(eventName)) return "PAID"
  if (["payment_session_expired", "payment_session_cancelled", "payment_session_canceled", "payment_cancelled", "payment_canceled", "invoice_expired"].includes(eventName)) return "EXPIRED"
  const status = payload.status || payload.data?.status
  if (status) return status
  return undefined
}

function getWebhookReference(payload: XenditInvoiceWebhook) {
  return (
    payload.external_id ||
    payload.reference_id ||
    payload.reference ||
    payload.metadata?.booking_reference ||
    payload.data?.external_id ||
    payload.data?.reference_id ||
    payload.data?.reference ||
    payload.data?.metadata?.booking_reference ||
    ""
  )
}

function getWebhookPaymentSessionId(payload: XenditInvoiceWebhook) {
  return payload.payment_session_id || payload.data?.payment_session_id || payload.id || payload.data?.id || ""
}

function getWebhookPosSaleId(payload: XenditInvoiceWebhook) {
  return payload.metadata?.pos_sale_id || payload.data?.metadata?.pos_sale_id || ""
}

function getWebhookPosReference(payload: XenditInvoiceWebhook) {
  return payload.metadata?.pos_payment_reference || payload.data?.metadata?.pos_payment_reference || getWebhookReference(payload)
}

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

  let payload: XenditInvoiceWebhook
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

  if (posSaleStatus && (posSaleId || paymentSessionId || posReference?.startsWith("pos_"))) {
    const sale = await findPosSaleForWebhook({ posSaleId, paymentSessionId, posReference })

    if (posSaleStatus === "CANCELLED") {
      const result = await cancelPendingPosSale(sale)
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

    if (!sale) {
      console.error("Received POS payment webhook without matching sale", {
        posSaleId,
        paymentSessionId,
        posReference,
        status: webhookStatus,
      })
      return NextResponse.json({ ok: true, posUpdated: 0 })
    }

    const updatedSale = await prisma.posSale.update({
      where: { id: sale.id },
      data: { status: "PAID" },
      include: { items: true },
    })

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

  const result = await prisma.classBooking.updateMany({
    where,
    data: {
      status: bookingStatus,
      holdExpiresAt: null,
      ...(bookingStatus === "CONFIRMED" ? { confirmedAt: new Date() } : { cancelledAt: new Date() }),
    },
  })

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
      where,
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
