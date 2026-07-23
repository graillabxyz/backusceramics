export type XenditWebhookPayload = {
  event?: string
  type?: string
  amount?: number | string
  currency?: string
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
    amount?: number | string
    currency?: string
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

export function extractBookingIds(payload: XenditWebhookPayload) {
  const bookingIds = payload.metadata?.booking_ids || payload.data?.metadata?.booking_ids
  if (typeof bookingIds !== "string") return []

  return bookingIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

export function mapInvoiceStatusToBookingStatus(status?: string) {
  const normalized = status?.toUpperCase().replace(/[\s.-]+/g, "_")
  if (["PAID", "SETTLED", "COMPLETED", "SUCCEEDED", "SUCCESS"].includes(normalized || "")) return "CONFIRMED"
  if (["EXPIRED", "CANCELLED", "CANCELED"].includes(normalized || "")) return "CANCELLED"
  return null
}

export function mapInvoiceStatusToPosSaleStatus(status?: string) {
  const normalized = status?.toUpperCase().replace(/[\s.-]+/g, "_")
  if (["PAID", "SETTLED", "COMPLETED", "SUCCEEDED", "SUCCESS"].includes(normalized || "")) return "PAID"
  if (["EXPIRED", "CANCELLED", "CANCELED"].includes(normalized || "")) return "CANCELLED"
  return null
}

export function getWebhookStatus(payload: XenditWebhookPayload) {
  const eventName = (payload.event || payload.type || "").toLowerCase().replace(/[\s.-]+/g, "_")
  if (["payment_session_completed", "payment_session_succeeded", "payment_succeeded", "invoice_paid"].includes(eventName)) return "PAID"
  if (["payment_session_expired", "payment_session_cancelled", "payment_session_canceled", "payment_cancelled", "payment_canceled", "invoice_expired"].includes(eventName)) return "EXPIRED"
  return payload.status || payload.data?.status
}

export function getWebhookAmount(payload: XenditWebhookPayload) {
  const rawAmount = payload.amount ?? payload.data?.amount
  if (rawAmount === undefined || rawAmount === null || rawAmount === "") return null

  const amount = Number(rawAmount)
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null
}

export function getWebhookCurrency(payload: XenditWebhookPayload) {
  const currency = payload.currency || payload.data?.currency || ""
  return currency.trim().toUpperCase()
}

export function isMatchingWebhookPaymentTotal(
  payload: XenditWebhookPayload,
  expectedAmount: number,
  expectedCurrency = "IDR"
) {
  const webhookAmount = getWebhookAmount(payload)
  const webhookCurrency = getWebhookCurrency(payload)

  if (webhookAmount !== null && webhookAmount !== expectedAmount) return false
  if (webhookCurrency && webhookCurrency !== expectedCurrency.trim().toUpperCase()) return false
  return true
}

export function getWebhookReference(payload: XenditWebhookPayload) {
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

export function getWebhookPaymentSessionId(payload: XenditWebhookPayload) {
  return payload.payment_session_id || payload.data?.payment_session_id || payload.id || payload.data?.id || ""
}

export function getWebhookPosSaleId(payload: XenditWebhookPayload) {
  return payload.metadata?.pos_sale_id || payload.data?.metadata?.pos_sale_id || ""
}

export function getWebhookPosReference(payload: XenditWebhookPayload) {
  return payload.metadata?.pos_payment_reference || payload.data?.metadata?.pos_payment_reference || getWebhookReference(payload)
}

export function hasExplicitPosIdentity(payload: XenditWebhookPayload) {
  const reference = getWebhookPosReference(payload).toLowerCase()
  return Boolean(getWebhookPosSaleId(payload) || reference.startsWith("pos_") || reference.startsWith("shop_"))
}
