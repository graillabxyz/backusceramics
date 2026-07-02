import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getXenditCallbackToken } from "@/lib/xendit"
import { sendPosReceiptEmail } from "@/lib/pos-receipts"

export const runtime = "nodejs"

type XenditInvoiceWebhook = {
  event?: string
  external_id?: string
  reference_id?: string
  id?: string
  payment_session_id?: string
  status?: string
  metadata?: {
    booking_ids?: string
    booking_reference?: string
    pos_sale_id?: string
    pos_payment_reference?: string
  }
  data?: {
    id?: string
    payment_session_id?: string
    external_id?: string
    reference_id?: string
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
  const normalized = status?.toUpperCase()
  if (normalized === "PAID" || normalized === "SETTLED") return "CONFIRMED"
  if (normalized === "EXPIRED" || normalized === "CANCELLED" || normalized === "CANCELED") return "CANCELLED"
  return null
}

function mapInvoiceStatusToPosSaleStatus(status?: string) {
  const normalized = status?.toUpperCase()
  if (normalized === "PAID" || normalized === "SETTLED") return "PAID"
  if (normalized === "EXPIRED" || normalized === "CANCELLED" || normalized === "CANCELED") return "CANCELLED"
  return null
}

function getWebhookStatus(payload: XenditInvoiceWebhook) {
  if (payload.event === "payment_session_completed") return "PAID"
  if (payload.event === "payment_session_expired") return "EXPIRED"
  const status = payload.status || payload.data?.status
  if (status) return status
  return undefined
}

function getWebhookReference(payload: XenditInvoiceWebhook) {
  return (
    payload.external_id ||
    payload.reference_id ||
    payload.metadata?.booking_reference ||
    payload.data?.external_id ||
    payload.data?.reference_id ||
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
  if (!incomingToken || incomingToken !== callbackToken) {
    return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 })
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

  return NextResponse.json({
    ok: true,
    status: bookingStatus,
    updated: result.count,
  })
}
