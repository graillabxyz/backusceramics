import { Resend } from "resend"
import { prisma } from "@/lib/prisma"
import { formatPrice, getProductCategoryLabel } from "@/lib/pos-catalog"
import type { PosCashReconciliation } from "@/lib/pos-cash-reconciliation"
import { getBaliBusinessWeek, getBaliDateKey } from "@/lib/pos-week"
import { buildSupplierLedgerReport, type SupplierAccountBalance, type SupplierBreakdown } from "@/lib/supplier-ledger"
import { summarizeCashOuts } from "@/lib/pos-cash-outs"
import { getPosSaleAttribution } from "@/lib/pos-sale-attribution"

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
  supplierBillCount: number
  supplierBillsTotal: number
  supplierPaymentCount: number
  supplierPaymentsTotal: number
  supplierCashPayments: number
  supplierNetChange: number
  supplierOutstanding: number
  supplierCredit: number
  supplierBreakdown: SupplierBreakdown[]
  supplierOutstandingBreakdown: SupplierAccountBalance[]
  registerPurchaseTotal: number
  registerReimbursementTotal: number
  registerCashOutTotal: number
  staffFundedTotal: number
  staffReimbursedTotal: number
  outstandingStaffDebt: number
  cashOutEntries: Array<{
    id: string
    fundingSource: string
    amount: number
    businessDate: string
    description: string
    reimbursedAt: Date | null
    reimbursedBusinessDate: string | null
    reimbursementMethod: string | null
    createdBy: { id: string; name: string | null; email: string } | null
    staffMember: { id: string; name: string | null; email: string } | null
  }>
  paidSales: SaleForCloseout[]
  voidedSales: SaleForCloseout[]
  pendingSales: SaleForCloseout[]
}

export interface PosWeeklyDailyBreakdown {
  businessDate: string
  saleCount: number
  itemCount: number
  netTotal: number
}

export interface PosWeeklyCashBreakdown {
  businessDate: string
  openingCash: number
  cashSales: number
  cashExpenses: number
  registerCashOuts: number
  supplierCashPayments: number
  expectedClosingCash: number
  closingCash: number
  cashVariance: number
  closedAt: string
}

export interface PosWeeklyCloseoutReport extends PosCloseoutReport {
  weekStart: string
  weekEnd: string
  weekCode: string
  dailyBreakdown: PosWeeklyDailyBreakdown[]
  dailyCashBreakdown: PosWeeklyCashBreakdown[]
  missingDailyCloseouts: string[]
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

async function buildReportForRange(businessDate: string, rangeStart: Date, rangeEnd: Date): Promise<PosCloseoutReport> {
  const endDate = getBaliDateKey(new Date(rangeEnd.getTime() - 1))
  const [sales, supplierReport, cashOutEntries, openStaffEntries] = await Promise.all([
    loadCloseoutSales(rangeStart, rangeEnd),
    buildSupplierLedgerReport(businessDate, endDate),
    prisma.posCashOut.findMany({
      where: { voidedAt: null, OR: [{ businessDate: { gte: businessDate, lte: endDate } }, { reimbursedBusinessDate: { gte: businessDate, lte: endDate } }] },
      orderBy: [{ businessDate: "asc" }, { createdAt: "asc" }],
      include: { createdBy: { select: { id: true, name: true, email: true } }, staffMember: { select: { id: true, name: true, email: true } } },
    }),
    prisma.posCashOut.findMany({
      where: { fundingSource: "STAFF", reimbursedAt: null, voidedAt: null },
      select: { fundingSource: true, amount: true, businessDate: true, reimbursedAt: true, reimbursedBusinessDate: true, reimbursementMethod: true, voidedAt: true },
    }),
  ])
  const cashOutSummary = summarizeCashOuts(cashOutEntries, businessDate, endDate)
  const outstandingStaffDebt = summarizeCashOuts(openStaffEntries, "0000-01-01", "9999-12-31").outstandingStaffDebt
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
    const attribution = getPosSaleAttribution(sale)
    addToBreakdown(operatorMap, attribution.key, attribution.label, {
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
    supplierBillCount: supplierReport.billCount,
    supplierBillsTotal: supplierReport.billsTotal,
    supplierPaymentCount: supplierReport.paymentCount,
    supplierPaymentsTotal: supplierReport.paymentsTotal,
    supplierCashPayments: supplierReport.entries.reduce((total, entry) => total + (entry.entryType === "PAYMENT" && entry.paymentMethod === "CASH" ? entry.amount : 0), 0),
    supplierNetChange: supplierReport.netChange,
    supplierOutstanding: supplierReport.outstanding,
    supplierCredit: supplierReport.supplierCredit,
    supplierBreakdown: supplierReport.breakdown,
    supplierOutstandingBreakdown: supplierReport.outstandingBreakdown,
    ...cashOutSummary,
    outstandingStaffDebt,
    cashOutEntries,
    paidSales,
    voidedSales,
    pendingSales,
  }
}

export async function buildPosCloseoutReport(dateKey?: string | null): Promise<PosCloseoutReport> {
  const { businessDate, rangeStart, rangeEnd } = getBaliBusinessDateRange(dateKey)
  return buildReportForRange(businessDate, rangeStart, rangeEnd)
}

export async function buildPosWeeklyCloseoutReport(anchorDate?: string | null): Promise<PosWeeklyCloseoutReport> {
  const week = getBaliBusinessWeek(anchorDate)
  const [report, dailyCloseouts] = await Promise.all([
    buildReportForRange(week.weekStart, week.rangeStart, week.rangeEnd),
    prisma.posCloseout.findMany({
      where: { businessDate: { gte: week.weekStart, lte: week.weekEnd } },
      orderBy: { businessDate: "asc" },
    }),
  ])

  const dailyMap = new Map<string, PosWeeklyDailyBreakdown>(week.dates.map((businessDate) => [businessDate, {
    businessDate,
    saleCount: 0,
    itemCount: 0,
    netTotal: 0,
  }]))

  for (const sale of report.paidSales) {
    const businessDate = getBaliDateKey(sale.createdAt)
    const day = dailyMap.get(businessDate)
    if (!day) continue
    day.saleCount += 1
    day.itemCount += sum(sale.items.map((item) => item.quantity))
    day.netTotal += sale.total
  }

  const dailyCashBreakdown = dailyCloseouts.map((closeout) => ({
    businessDate: closeout.businessDate,
    openingCash: closeout.openingCash,
    cashSales: closeout.cashSales,
    cashExpenses: closeout.cashExpenses,
    registerCashOuts: closeout.registerCashOuts,
    supplierCashPayments: closeout.supplierCashPayments,
    expectedClosingCash: closeout.expectedClosingCash,
    closingCash: closeout.closingCash,
    cashVariance: closeout.cashVariance,
    closedAt: closeout.closedAt.toISOString(),
  }))
  const closedDates = new Set(dailyCloseouts.map((closeout) => closeout.businessDate))

  return {
    ...report,
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    weekCode: week.weekCode,
    dailyBreakdown: Array.from(dailyMap.values()),
    dailyCashBreakdown,
    missingDailyCloseouts: week.dates.filter((date) => !closedDates.has(date)),
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

function supplierRows(items: SupplierBreakdown[]) {
  return items.map((item) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(item.supplierName)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatPrice(item.billsTotal)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">-${formatPrice(item.paymentsTotal)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${formatPrice(item.netChange)}</td>
    </tr>
  `).join("")
}

function supplierBalanceRows(items: SupplierAccountBalance[]) {
  return items.map((item) => {
    const balance = item.outstandingDebt > 0
      ? `${formatPrice(item.outstandingDebt)} owed`
      : item.supplierCredit > 0
        ? `${formatPrice(item.supplierCredit)} credit`
        : "Settled"
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(item.supplierName)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${balance}</td>
    </tr>`
  }).join("")
}

function buildCloseoutHtml(report: PosCloseoutReport, cash: PosCashReconciliation, notes?: string | null) {
  const expenseRows = cash.cashExpenseItems.map((expense) => `
    <tr><td style="padding:6px 0;color:#777;">${escapeHtml(expense.description)}</td><td style="padding:6px 0;text-align:right;">-${formatPrice(expense.amount)}</td></tr>
  `).join("")
  const cashOutRows = report.cashOutEntries.map((entry) => `
    <tr><td style="padding:6px 0;color:#777;">${escapeHtml(entry.description)} · ${entry.fundingSource === "STAFF" ? `staff paid (${escapeHtml(entry.staffMember?.name || entry.staffMember?.email || "staff")})` : "register cash"}</td><td style="padding:6px 0;text-align:right;">${formatPrice(entry.amount)}</td></tr>
  `).join("")

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
        <h2 style="margin:0 0 12px;font-size:18px;">Cash reconciliation</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            <tr><td style="padding:6px 0;color:#777;">Opening register cash</td><td style="padding:6px 0;text-align:right;">${formatPrice(cash.openingCash)}</td></tr>
            <tr><td style="padding:6px 0;color:#777;">Cash sales</td><td style="padding:6px 0;text-align:right;">${formatPrice(cash.cashSales)}</td></tr>
            ${expenseRows}
            ${cashOutRows}
            <tr><td style="padding:6px 0;color:#777;">Cash expenses total</td><td style="padding:6px 0;text-align:right;">-${formatPrice(cash.cashExpenses)}</td></tr>
            <tr><td style="padding:6px 0;color:#777;">Logged register cash outs</td><td style="padding:6px 0;text-align:right;">-${formatPrice(cash.registerCashOuts)}</td></tr>
            <tr><td style="padding:6px 0;color:#777;">Cash supplier payments</td><td style="padding:6px 0;text-align:right;">-${formatPrice(cash.supplierCashPayments)}</td></tr>
            <tr><td style="padding:10px 0;font-weight:700;border-top:1px solid #eee;">Expected closing cash</td><td style="padding:10px 0;text-align:right;font-weight:700;border-top:1px solid #eee;">${formatPrice(cash.expectedClosingCash)}</td></tr>
            <tr><td style="padding:6px 0;color:#777;">Counted closing cash</td><td style="padding:6px 0;text-align:right;">${formatPrice(cash.closingCash)}</td></tr>
            <tr><td style="padding:6px 0;font-weight:700;">Over / short</td><td style="padding:6px 0;text-align:right;font-weight:700;">${cash.cashVariance > 0 ? "+" : cash.cashVariance < 0 ? "-" : ""}${formatPrice(Math.abs(cash.cashVariance))}</td></tr>
          </tbody>
        </table>
      </div>
      <div style="padding:8px 0 24px;">
        <h2 style="margin:0 0 12px;font-size:18px;">Staff reimbursements</h2>
        <table style="width:100%;border-collapse:collapse;"><tbody>
          <tr><td style="padding:6px 0;color:#777;">Staff-funded purchases</td><td style="padding:6px 0;text-align:right;">${formatPrice(report.staffFundedTotal)}</td></tr>
          <tr><td style="padding:6px 0;color:#777;">Reimbursed in period</td><td style="padding:6px 0;text-align:right;">${formatPrice(report.staffReimbursedTotal)}</td></tr>
          <tr><td style="padding:10px 0;font-weight:700;border-top:1px solid #eee;">Outstanding staff debt</td><td style="padding:10px 0;text-align:right;font-weight:700;border-top:1px solid #eee;">${formatPrice(report.outstandingStaffDebt)}</td></tr>
        </tbody></table>
      </div>
      <div style="padding:8px 0 24px;">
        <h2 style="margin:0 0 12px;font-size:18px;">Categories</h2>
        <table style="width:100%;border-collapse:collapse;">${breakdownRows(report.categoryBreakdown)}</table>
      </div>
      <div style="padding:8px 0 24px;">
        <h2 style="margin:0 0 12px;font-size:18px;">Supplier accounts</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            <tr><td style="padding:6px 0;color:#777;">Bills received</td><td style="padding:6px 0;text-align:right;">${report.supplierBillCount} / ${formatPrice(report.supplierBillsTotal)}</td></tr>
            <tr><td style="padding:6px 0;color:#777;">Payments made</td><td style="padding:6px 0;text-align:right;">${report.supplierPaymentCount} / ${formatPrice(report.supplierPaymentsTotal)}</td></tr>
            <tr><td style="padding:10px 0;font-weight:700;border-top:1px solid #eee;">Current supplier debt</td><td style="padding:10px 0;text-align:right;font-weight:700;border-top:1px solid #eee;">${formatPrice(report.supplierOutstanding)}</td></tr>
            ${report.supplierCredit > 0 ? `<tr><td style="padding:6px 0;color:#777;">Supplier credit</td><td style="padding:6px 0;text-align:right;">${formatPrice(report.supplierCredit)}</td></tr>` : ""}
          </tbody>
        </table>
        ${report.supplierOutstandingBreakdown.length ? `<h3 style="margin:16px 0 4px;font-size:14px;">Current balance by outlet</h3><table style="width:100%;border-collapse:collapse;">${supplierBalanceRows(report.supplierOutstandingBreakdown)}</table>` : ""}
        ${report.supplierBreakdown.length ? `<h3 style="margin:16px 0 4px;font-size:14px;">Activity this period</h3><table style="width:100%;border-collapse:collapse;">${supplierRows(report.supplierBreakdown)}</table>` : ""}
      </div>
      ${notes ? `<div style="padding:16px 0;border-top:1px solid #e8e1d8;"><strong>Notes</strong><p style="white-space:pre-line;color:#555;">${escapeHtml(notes)}</p></div>` : ""}
    </div>
  `
}

export async function sendPosCloseoutReportEmail(report: PosCloseoutReport, cash: PosCashReconciliation, toEmail: string, notes?: string | null) {
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
    html: buildCloseoutHtml(report, cash, notes),
  })

  if (error) {
    console.error("POS closeout report email failed", { error, businessDate: report.businessDate })
    return false
  }

  return true
}

function buildWeeklyCloseoutHtml(report: PosWeeklyCloseoutReport, notes?: string | null) {
  const cashByDate = new Map(report.dailyCashBreakdown.map((day) => [day.businessDate, day]))
  const dailyRows = report.dailyBreakdown.map((day) => {
    const cash = cashByDate.get(day.businessDate)
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(day.businessDate)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${day.saleCount}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatPrice(day.netTotal)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${cash ? formatPrice(cash.cashVariance) : "Not closed"}</td>
    </tr>`
  }).join("")

  return `<div style="font-family:Inter,Arial,sans-serif;max-width:760px;margin:0 auto;color:#1f1f1f;">
    <div style="padding:28px 0;border-bottom:1px solid #e8e1d8;">
      <h1 style="margin:0;font-size:24px;">Backus Ceramics weekly POS closeout</h1>
      <p style="margin:6px 0 0;color:#777;">Monday ${escapeHtml(report.weekStart)} through Saturday ${escapeHtml(report.weekEnd)}</p>
    </div>
    <div style="padding:24px 0;">
      <h2 style="margin:0 0 12px;font-size:18px;">Weekly summary</h2>
      <table style="width:100%;border-collapse:collapse;"><tbody>
        <tr><td style="padding:6px 0;color:#777;">Paid sales</td><td style="text-align:right;">${report.saleCount}</td></tr>
        <tr><td style="padding:6px 0;color:#777;">Items sold</td><td style="text-align:right;">${report.itemCount}</td></tr>
        <tr><td style="padding:6px 0;color:#777;">Discounts</td><td style="text-align:right;">-${formatPrice(report.discountTotal)}</td></tr>
        <tr><td style="padding:6px 0;color:#777;">Tax</td><td style="text-align:right;">${formatPrice(report.taxTotal)}</td></tr>
        <tr><td style="padding:6px 0;color:#777;">Register cash outs</td><td style="text-align:right;">-${formatPrice(report.registerCashOutTotal)}</td></tr>
        <tr><td style="padding:6px 0;color:#777;">Staff-funded purchases</td><td style="text-align:right;">${formatPrice(report.staffFundedTotal)}</td></tr>
        <tr><td style="padding:6px 0;color:#777;">Staff reimbursements</td><td style="text-align:right;">${formatPrice(report.staffReimbursedTotal)}</td></tr>
        <tr><td style="padding:6px 0;color:#777;">Outstanding staff debt</td><td style="text-align:right;font-weight:700;">${formatPrice(report.outstandingStaffDebt)}</td></tr>
        <tr><td style="padding:10px 0;font-weight:700;border-top:1px solid #eee;">Net collected</td><td style="padding:10px 0;text-align:right;font-weight:700;border-top:1px solid #eee;">${formatPrice(report.netTotal)}</td></tr>
      </tbody></table>
    </div>
    ${report.missingDailyCloseouts.length ? `<p style="padding:12px;background:#fff6df;border:1px solid #edd9a3;">Cash reconciliation is incomplete. Missing daily closeouts: ${escapeHtml(report.missingDailyCloseouts.join(", "))}.</p>` : ""}
    <div style="padding:8px 0 24px;"><h2 style="font-size:18px;">Daily activity</h2><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;">Date</th><th style="text-align:right;">Sales</th><th style="text-align:right;">Net</th><th style="text-align:right;">Cash variance</th></tr></thead><tbody>${dailyRows}</tbody></table></div>
    <div style="padding:8px 0 24px;"><h2 style="font-size:18px;">Payment methods</h2><table style="width:100%;border-collapse:collapse;">${breakdownRows(report.paymentBreakdown)}</table></div>
    <div style="padding:8px 0 24px;"><h2 style="font-size:18px;">Categories</h2><table style="width:100%;border-collapse:collapse;">${breakdownRows(report.categoryBreakdown)}</table></div>
    <div style="padding:8px 0 24px;"><h2 style="font-size:18px;">Supplier accounts</h2><table style="width:100%;border-collapse:collapse;"><tbody>
      <tr><td style="padding:6px 0;color:#777;">Bills received</td><td style="text-align:right;">${report.supplierBillCount} / ${formatPrice(report.supplierBillsTotal)}</td></tr>
      <tr><td style="padding:6px 0;color:#777;">Payments made</td><td style="text-align:right;">${report.supplierPaymentCount} / ${formatPrice(report.supplierPaymentsTotal)}</td></tr>
      <tr><td style="padding:10px 0;font-weight:700;border-top:1px solid #eee;">Current supplier debt</td><td style="padding:10px 0;text-align:right;font-weight:700;border-top:1px solid #eee;">${formatPrice(report.supplierOutstanding)}</td></tr>
      ${report.supplierCredit > 0 ? `<tr><td style="padding:6px 0;color:#777;">Supplier credit</td><td style="text-align:right;">${formatPrice(report.supplierCredit)}</td></tr>` : ""}
    </tbody></table>${report.supplierOutstandingBreakdown.length ? `<h3 style="margin:16px 0 4px;font-size:14px;">Current balance by outlet</h3><table style="width:100%;border-collapse:collapse;">${supplierBalanceRows(report.supplierOutstandingBreakdown)}</table>` : ""}${report.supplierBreakdown.length ? `<h3 style="margin:16px 0 4px;font-size:14px;">Activity this week</h3><table style="width:100%;border-collapse:collapse;">${supplierRows(report.supplierBreakdown)}</table>` : ""}</div>
    ${notes ? `<div style="padding:16px 0;border-top:1px solid #e8e1d8;"><strong>Notes</strong><p style="white-space:pre-line;color:#555;">${escapeHtml(notes)}</p></div>` : ""}
  </div>`
}

export async function sendPosWeeklyCloseoutReportEmail(report: PosWeeklyCloseoutReport, toEmail: string, notes?: string | null) {
  const email = toEmail.trim()
  if (!email) return false
  const resend = getResendClient()
  if (!resend) {
    console.error("RESEND_API_KEY is not set; weekly POS closeout email was not sent", { weekCode: report.weekCode })
    return false
  }

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to: email,
    subject: `Backus Ceramics weekly POS closeout ${report.weekStart} - ${report.weekEnd}`,
    html: buildWeeklyCloseoutHtml(report, notes),
  })
  if (error) {
    console.error("Weekly POS closeout report email failed", { error, weekCode: report.weekCode })
    return false
  }
  return true
}
