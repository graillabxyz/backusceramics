import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getXenditCallbackToken } from "@/lib/xendit"

export const runtime = "nodejs"

type XenditInvoiceWebhook = {
  event?: string
  external_id?: string
  reference_id?: string
  status?: string
  metadata?: {
    booking_ids?: string
    booking_reference?: string
  }
  data?: {
    external_id?: string
    reference_id?: string
    status?: string
    metadata?: {
      booking_ids?: string
      booking_reference?: string
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
  const bookingStatus = mapInvoiceStatusToBookingStatus(webhookStatus)
  if (!bookingStatus) {
    return NextResponse.json({ ok: true, ignored: true, status: webhookStatus || null })
  }

  const bookingIds = extractBookingIds(payload)
  const externalId = getWebhookReference(payload)
  const where = bookingIds.length > 0
    ? { id: { in: bookingIds } }
    : externalId
      ? { notes: { contains: externalId } }
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
    data: { status: bookingStatus },
  })

  return NextResponse.json({
    ok: true,
    status: bookingStatus,
    updated: result.count,
  })
}
