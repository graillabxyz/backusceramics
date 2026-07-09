import { Resend } from "resend"
import { prisma } from "@/lib/prisma"
import { formatPrice, getProductCategoryLabel } from "@/lib/pos-catalog"

const BALI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000

type SaleForCloseout = Awaited<ReturnType<typeof loadCloseoutSales>>[number]

interface Breakdown {
  key: string
  label: string
  count: number
  quantity: number
  subtotal: number
  discount: number
  tax: number
  total: number
}

export interface PosCloseoutReport {
  businessDate: string
  rangeStart: string
  rangeEnd: string
  saleCount: number
  itemCount: number
  grossSubtotal: number
  discountTotal: number
  taxTotal: number
  netTotal: number
  voidedSaleCount: number
  voidedTotal: number
  pendingSaleCount: number
  pendingTotal: number
  paymentBreakdown: Breakdown[]
  categoryBreakdown: Breakdown[]
  operatorBreakdown: Breakdown[]
  paidSales: SaleForCloseout[]
  voidedSales: SaleForCloseout[]
  pendingSales: SaleForCloseout[]
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  return apiKey ? new Resend(apiKey) : null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function isInRange(value: Date | null | undefined, start: Date, end: Date) {
  if (!value) return false
  return value >= start && value < end
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function formatPaymentMethod(value: string) {
  if (value === "CARD_MACHINE") return "Card machine"
  if (value === "ONLINE") return "Online payment"
  if (value === "QRIS") return "QRIS"
  return value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase())
}

function operatorLabel(sale: SaleForCloseout) {
  return sale.operator?.name || sale.operator?.email || "Unknown operator"
}

function createBreakdown(key: string, label: string): Breakdown {
  return { key, label, count: 0, quantity: 0, subtotal: 0, discount: 0, tax: 0, total: 0 }
}

function addToBreakdown(map: Map<string, Breakdown>, key: string, label: string, values: Partial<Breakdown>) {
  const current = map.get(key) || createBreakdown(key, label)
  current.count += values.count || 0
  current.quantity += values.quantity || 0
  current.subtotal += values.subtotal || 0
  current.discount += values.discount || 0
  current.tax += values.tax || 0
  current.total += values.total || 0
  map.set(key, current)
}

function sortBreakdowns(items: Breakdown[]) {
  return items.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
}

function normalizeBusinessDate(dateKey?: string | null) {
  if (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey
  return new Date(Date.now() + BALI_UTC_OFFSET_MS).toISOString().slice(0, 10)
}

export function getBaliBusinessDateRange(dateKey?: string | null) {
  const businessDate = normalizeBusinessDate(dateKey)
  const [year, month, day] = businessDate.split("-").map(Number)
  const rangeStart = new Date(Date.UTC(year, month - 1, day) - BALI_UTC_OFFSET_MS)
  const rangeEnd = new Date(Date.UTC(year, month - 1, day + 1) - BALI_UTC_OFFSET_MS)

  return { businessDate, rangeStart, rangeEnd }
}

async function loadCloseoutSales(rangeStart: Date, rangeEnd: Date) {
  return prisma.posSale.findMany({
    where: {
      OR: [
        { createdAt: { gte: rangeStart, lt: rangeEnd } },
        { voidedAt: { gte: rangeStart, lt: rangeEnd } },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: true,
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      voidedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })
}

export async function buildPosCloseoutReport(dateKey?: string | null): Promise<PosCloseoutReport> {
  const { businessDate, rangeStart, rangeEnd } = getBaliBusinessDateRange(dateKey)
  const sales = await loadCloseoutSales(rangeStart, rangeEnd)
  const createdToday = sales.filter((sale) => isInRange(sale.createdAt, rangeStart, rangeEnd))
  const paidSales = createdToday.filter((sale) => sale.status === "PAID")
  const pendingSales = createdToday.filter((sale) => sale.status === "PENDING_PAYMENT")
  const voidedSales = sales.filter((sale) => sale.status === "VOIDED" && (
    isInRange(sale.createdAt, rangeStart, rangeEnd) || isInRange(sale.voidedAt, rangeStart, rangeEnd)
  ))

  const paymentMap = new Map<string, Breakdown>()
  const categoryMap = new Map<string, Breakdown>()
  const operatorMap = new Map<string, Breakdown>()

  for (const sale of paidSales) {
    const quantity = sum(sale.items.map((item) => item.quantity))
    addToBreakdown(paymentMap, sale.paymentMethod, formatPaymentMethod(sale.paymentMethod), {
      count: 1,
      quantity,
      subtotal: sale.subtotal,
      discount: sale.discountTotal,
      tax: sale.taxTotal,
      total: sale.total,
    })
    addToBreakdown(operatorMap, sale.operatorId || "unknown", operatorLabel(sale), {
      count: 1,
      quantity,
      subtotal: sale.subtotal,
      discount: sale.discountTotal,
      tax: sale.taxTotal,
      total: sale.total,
    })

    for (const item of sale.items) {
      addToBreakdown(categoryMap, item.categorySnapshot, getProductCategoryLabel(item.categorySnapshot), {
        quantity: item.quantity,
        subtotal: item.subtotal,
        discount: item.discountAmount,
        tax: item.taxAmount,
        total: item.lineTotal,
      })
    }
  }

  return {
    businessDate,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    saleCount: paidSales.length,
    itemCount: sum(paidSales.flatMap((sale) => sale.items.map((item) => item.quantity))),
    grossSubtotal: sum(paidSales.map((sale) => sale.subtotal)),
    discountTotal: sum(paidSales.map((sale) => sale.discountTotal)),
    taxTotal: sum(paidSales.map((sale) => sale.taxTotal)),
    netTotal: sum(paidSales.map((sale) => sale.total)),
    voidedSaleCount: voidedSales.length,
    voidedTotal: sum(voidedSales.map((sale) => sale.total)),
    pendingSaleCount: pendingSales.length,
    pendingTotal: sum(pendingSales.map((sale) => sale.total)),
    paymentBreakdown: sortBreakdowns(Array.from(paymentMap.values())),
    categoryBreakdown: sortBreakdowns(Array.from(categoryMap.values())),
    operatorBreakdown: sortBreakdowns(Array.from(operatorMap.values())),
    paidSales,
    voidedSales,
    pendingSales,
  }
}

function breakdownRows(items: Breakdown[]) {
  return items.map((item) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(item.label)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${item.count || item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatPrice(item.total)}</td>
    </tr>
  `).join("")
}

function buildCloseoutHtml(report: PosCloseoutReport, notes?: string | null) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:720px;margin:0 auto;color:#1f1f1f;">
      <div style="padding:28px 0;border-bottom:1px solid #e8e1d8;">
        <h1 style="margin:0;font-size:24px;">Backus Ceramics POS closeout</h1>
        <p style="margin:6px 0 0;color:#777;">Business date ${escapeHtml(report.businessDate)}</p>
      </div>
      <div style="padding:24px 0;">
        <h2 style="margin:0 0 12px;font-size:18px;">Accounting summary</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            <tr><td style="padding:6px 0;color:#777;">Paid sales</td><td style="padding:6px 0;text-align:right;">${report.saleCount}</td></tr>
            <tr><td style="padding:6px 0;color:#777;">Items sold</td><td style="padding:6px 0;text-align:right;">${report.itemCount}</td></tr>
            <tr><td style="padding:6px 0;color:#777;">Gross subtotal</td><td style="padding:6px 0;text-align:right;">${formatPrice(report.grossSubtotal)}</td></tr>
            <tr><td style="padding:6px 0;color:#777;">Discounts</td><td style="padding:6px 0;text-align:right;">-${formatPrice(report.discountTotal)}</td></tr>
            <tr><td style="padding:6px 0;color:#777;">Tax</td><td style="padding:6px 0;text-align:right;">${formatPrice(report.taxTotal)}</td></tr>
            <tr><td style="padding:10px 0;font-weight:700;border-top:1px solid #eee;">Net collected</td><td style="padding:10px 0;text-align:right;font-weight:700;border-top:1px solid #eee;">${formatPrice(report.netTotal)}</td></tr>
            <tr><td style="padding:6px 0;color:#777;">Voided sales</td><td style="padding:6px 0;text-align:right;">${report.voidedSaleCount} / ${formatPrice(report.voidedTotal)}</td></tr>
            <tr><td style="padding:6px 0;color:#777;">Pending online sales</td><td style="padding:6px 0;text-align:right;">${report.pendingSaleCount} / ${formatPrice(report.pendingTotal)}</td></tr>
          </tbody>
        </table>
      </div>
      <div style="padding:8px 0 24px;">
        <h2 style="margin:0 0 12px;font-size:18px;">Payment methods</h2>
        <table style="width:100%;border-collapse:collapse;">${breakdownRows(report.paymentBreakdown)}</table>
      </div>
      <div style="padding:8px 0 24px;">
        <h2 style="margin:0 0 12px;font-size:18px;">Categories</h2>
        <table style="width:100%;border-collapse:collapse;">${breakdownRows(report.categoryBreakdown)}</table>
      </div>
      ${notes ? `<div style="padding:16px 0;border-top:1px solid #e8e1d8;"><strong>Notes</strong><p style="white-space:pre-line;color:#555;">${escapeHtml(notes)}</p></div>` : ""}
    </div>
  `
}

export async function sendPosCloseoutReportEmail(report: PosCloseoutReport, toEmail: string, notes?: string | null) {
  const email = toEmail.trim()
  if (!email) return false

  const resend = getResendClient()
  if (!resend) {
    console.error("RESEND_API_KEY is not set; POS closeout report email was not sent", { businessDate: report.businessDate })
    return false
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: `Backus Ceramics POS closeout ${report.businessDate}`,
    html: buildCloseoutHtml(report, notes),
  })

  if (error) {
    console.error("POS closeout report email failed", { error, businessDate: report.businessDate })
    return false
  }

  return true
}
