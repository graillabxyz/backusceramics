export const SALES_CHANNELS = ["POS", "WEBSITE", "PAYMENT_LINK", "GIFT_VOUCHER"] as const

export type SalesChannel = (typeof SALES_CHANNELS)[number]

export interface SalesChannelInput {
  operatorId?: string | null
  paymentMethod?: string | null
  paymentReference?: string | null
  paymentSessionId?: string | null
  paymentLinkId?: string | null
  notes?: string | null
}

const ONLINE_SHOP_NOTE = "[online-shop]"
const PAYMENT_LINK_NOTE = "[payment-link]"
const GIFT_VOUCHER_NOTE = "[gift-voucher]"

export function getSalesChannel(sale: SalesChannelInput): SalesChannel {
  const notes = sale.notes || ""
  if (notes.includes(GIFT_VOUCHER_NOTE)) return "GIFT_VOUCHER"
  if (sale.paymentLinkId || notes.includes(PAYMENT_LINK_NOTE)) return "PAYMENT_LINK"
  if (notes.trimStart().startsWith(ONLINE_SHOP_NOTE)) return "WEBSITE"
  if (!sale.operatorId && sale.paymentMethod === "ONLINE" && Boolean(sale.paymentSessionId || sale.paymentReference)) return "WEBSITE"
  return "POS"
}

export const salesChannelLabels: Record<SalesChannel, string> = {
  POS: "Point of sale",
  WEBSITE: "Website shop",
  PAYMENT_LINK: "Payment link",
  GIFT_VOUCHER: "Gift card",
}

export function isOnlineSalesChannel(channel: SalesChannel) {
  return channel !== "POS"
}
