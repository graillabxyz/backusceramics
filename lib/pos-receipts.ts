import { Resend } from "resend"
import { formatPrice } from "@/lib/pos-catalog"

interface ReceiptItem {
  nameSnapshot: string
  skuSnapshot?: string | null
  quantity: number
  unitPrice: number
  subtotal?: number
  discountAmount?: number
  taxRate?: number
  taxAmount?: number
  lineTotal: number
}

interface ReceiptSale {
  id: string
  subtotal?: number
  discountTotal?: number
  taxTotal?: number
  shippingAmount?: number
  total: number
  currency: string
  paymentMethod: string
  createdAt: Date
  receiptEmail?: string | null
  fulfillmentMethod?: string
  shippingCountry?: string | null
  shippingPostalCode?: string | null
  shippingCity?: string | null
  shippingAddress?: string | null
  items: ReceiptItem[]
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

function formatPaymentMethod(value: string) {
  if (value === "CARD_MACHINE") return "Card machine"
  if (value === "ONLINE") return "Online payment"
  if (value === "QRIS") return "QRIS"
  return value.toLowerCase().replace(/^\w/, (char) => char.toUpperCase())
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function buildReceiptHtml(sale: ReceiptSale) {
  const rows = sale.items.map((item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #eee;">
        <strong>${escapeHtml(item.nameSnapshot)}</strong>
        ${item.skuSnapshot ? `<br><span style="color:#777;font-size:12px;">${escapeHtml(item.skuSnapshot)}</span>` : ""}
        ${item.discountAmount ? `<br><span style="color:#777;font-size:12px;">Discount -${formatPrice(item.discountAmount)}</span>` : ""}
        ${item.taxAmount ? `<br><span style="color:#777;font-size:12px;">Tax ${item.taxRate || 0}% ${formatPrice(item.taxAmount)}</span>` : ""}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;">${formatPrice(item.lineTotal)}</td>
    </tr>
  `).join("")

  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f1f1f;">
      <div style="padding:28px 0;border-bottom:1px solid #e8e1d8;">
        <h1 style="margin:0;font-size:24px;">Backus Ceramics</h1>
        <p style="margin:6px 0 0;color:#777;">Receipt ${sale.id}</p>
      </div>
      <div style="padding:24px 0;">
        <p style="margin:0 0 8px;">Thank you for visiting the studio.</p>
        <p style="margin:0;color:#777;">Paid by ${formatPaymentMethod(sale.paymentMethod)} on ${sale.createdAt.toLocaleString("en-US", { timeZone: "Asia/Makassar" })}.</p>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="color:#777;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">
            <th style="text-align:left;padding-bottom:8px;">Item</th>
            <th style="text-align:center;padding-bottom:8px;">Qty</th>
            <th style="text-align:right;padding-bottom:8px;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="padding:20px 0;text-align:right;">
        <div style="font-size:13px;color:#777;">Subtotal ${formatPrice(sale.subtotal ?? sale.total)}</div>
        ${(sale.discountTotal || 0) > 0 ? `<div style="font-size:13px;color:#777;">Discount -${formatPrice(sale.discountTotal || 0)}</div>` : ""}
        ${(sale.taxTotal || 0) > 0 ? `<div style="font-size:13px;color:#777;">Tax ${formatPrice(sale.taxTotal || 0)}</div>` : ""}
        ${(sale.shippingAmount || 0) > 0 ? `<div style="font-size:13px;color:#777;">Packing and shipping ${formatPrice(sale.shippingAmount || 0)}</div>` : ""}
        <div style="margin-top:8px;font-size:20px;font-weight:700;">${formatPrice(sale.total)}</div>
      </div>
      ${sale.fulfillmentMethod === "SHIPPING" ? `
        <div style="padding:16px 0;border-top:1px solid #e8e1d8;">
          <strong>Shipping to</strong>
          <p style="margin:6px 0 0;color:#777;line-height:1.5;">
            ${escapeHtml(sale.shippingAddress || "")}<br>
            ${escapeHtml([sale.shippingCity, sale.shippingPostalCode, sale.shippingCountry].filter(Boolean).join(", "))}
          </p>
        </div>
      ` : ""}
      <p style="padding-top:20px;border-top:1px solid #e8e1d8;color:#777;font-size:13px;">
        Backus Ceramics, Bali. If you have questions about this purchase, reply to this email or message us on WhatsApp.
      </p>
    </div>
  `
}

export async function sendPosReceiptEmail(sale: ReceiptSale) {
  const receiptEmail = sale.receiptEmail?.trim()
  if (!receiptEmail) return false

  const resend = getResendClient()
  if (!resend) {
    console.error("RESEND_API_KEY is not set; POS receipt email was not sent", { saleId: sale.id })
    return false
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: receiptEmail,
    subject: `Backus Ceramics receipt ${sale.id}`,
    html: buildReceiptHtml(sale),
  })

  if (error) {
    console.error("POS receipt email failed", { error, saleId: sale.id })
    return false
  }

  return true
}
