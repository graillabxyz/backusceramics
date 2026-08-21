import { cleanString, isValidEmailAddress } from "@/lib/server-security"

export const PAYMENT_LINK_PURPOSES = ["CUSTOM_ORDER", "SHIPPING", "DEPOSIT", "OTHER"] as const
export type PaymentLinkPurpose = (typeof PAYMENT_LINK_PURPOSES)[number]

export const paymentLinkPurposeLabels: Record<PaymentLinkPurpose, string> = {
  CUSTOM_ORDER: "Custom order",
  SHIPPING: "Shipping",
  DEPOSIT: "Deposit",
  OTHER: "Other payment",
}

export const PAYMENT_LINK_NOTE = "[online-shop] [payment-link]"
export const PAYMENT_LINK_MIN_AMOUNT = 10_000
export const PAYMENT_LINK_MAX_AMOUNT = 1_000_000_000

export function parsePaymentLinkInput(data: Record<string, unknown>) {
  const title = cleanString(data.title, 120)
  const description = cleanString(data.description, 1000)
  const amount = Number(data.amount)
  const purpose = cleanString(data.purpose, 40).toUpperCase() as PaymentLinkPurpose
  const customerName = cleanString(data.customerName, 160)
  const customerEmail = cleanString(data.customerEmail, 254).toLowerCase()
  const customerPhone = cleanString(data.customerPhone, 60)
  const expiresInDays = Number(data.expiresInDays || 7)

  const error = !title
    ? "Add a clear payment title."
    : !Number.isInteger(amount) || amount < PAYMENT_LINK_MIN_AMOUNT || amount > PAYMENT_LINK_MAX_AMOUNT
      ? "Amount must be between Rp 10.000 and Rp 1.000.000.000."
      : !PAYMENT_LINK_PURPOSES.includes(purpose)
        ? "Choose a valid payment type."
        : customerEmail && !isValidEmailAddress(customerEmail)
          ? "Enter a valid customer email."
          : ![1, 3, 7, 14, 30].includes(expiresInDays)
            ? "Choose a valid expiry period."
            : ""

  return {
    error,
    values: {
      title,
      description: description || null,
      amount,
      purpose,
      customerName: customerName || null,
      customerEmail: customerEmail || null,
      customerPhone: customerPhone || null,
      expiresInDays,
    },
  }
}

export function getPaymentLinkStatus(link: {
  status: string
  expiresAt: Date | string
  sales?: Array<{ status: string }>
}, now = new Date()) {
  if (link.sales?.some((sale) => sale.status === "PAID")) return "PAID"
  if (link.status === "CANCELLED") return "CANCELLED"
  if (new Date(link.expiresAt) <= now) return "EXPIRED"
  if (link.sales?.some((sale) => sale.status === "PENDING_PAYMENT")) return "ACTIVE"
  return link.status === "ACTIVE" ? "ACTIVE" : "CANCELLED"
}
