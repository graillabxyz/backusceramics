"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Printer,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { formatPrice } from "@/lib/pos-catalog"
import { calculatePosCashReconciliation, type PosCashExpense } from "@/lib/pos-cash-reconciliation"

const BALI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000
const WHATSAPP_REPORT_NUMBER = "6282145890402"

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

interface CloseoutSaleItem {
  id: string
  nameSnapshot: string
  categorySnapshot: string
  quantity: number
  lineTotal: number
}

interface CloseoutSale {
  id: string
  total: number
  status: string
  paymentMethod: string
  createdAt: string
  voidedAt: string | null
  voidReason: string | null
  items: CloseoutSaleItem[]
}

interface CloseoutReport {
  businessDate: string
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
  supplierBreakdown: Array<{ supplierId: string; supplierName: string; billCount: number; billsTotal: number; paymentCount: number; paymentsTotal: number; netChange: number }>
  supplierOutstandingBreakdown: Array<{ supplierId: string; supplierName: string; billCount: number; billsTotal: number; paymentCount: number; paymentsTotal: number; netChange: number; outstandingDebt: number; supplierCredit: number }>
  registerCashOutTotal: number
  staffFundedTotal: number
  staffReimbursedTotal: number
  outstandingStaffDebt: number
  cashOutEntries: Array<{ id: string; fundingSource: string; amount: number; businessDate: string; description: string; reimbursedAt: string | null; reimbursementMethod: string | null; createdBy: CloseoutUser | null; staffMember: CloseoutUser | null }>
  paidSales: CloseoutSale[]
  voidedSales: CloseoutSale[]
  pendingSales: CloseoutSale[]
}

interface CloseoutUser {
  id: string
  name: string | null
  email: string | null
}

interface CloseoutRecord {
  id: string
  businessDate: string
  closedAt: string
  notes: string | null
  openingCash: number
  cashSales: number
  cashExpenses: number
  cashExpenseItems: string
  expectedClosingCash: number
  closingCash: number
  cashVariance: number
  closedBy: CloseoutUser | null
}

interface CashExpenseDraft {
  id: string
  description: string
  amount: string
}

function todayInBali() {
  return new Date(Date.now() + BALI_UTC_OFFSET_MS).toISOString().slice(0, 10)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function paymentLabel(value: string) {
  if (value === "CARD_MACHINE") return "Card machine"
  if (value === "ONLINE") return "Online payment"
  if (value === "QRIS") return "QRIS"
  return value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase())
}

function saleSummary(sale: CloseoutSale) {
  const names = sale.items.map((item) => `${item.quantity} x ${item.nameSnapshot}`)
  if (names.length <= 2) return names.join(", ")
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`
}

function detailedSaleLines(sales: CloseoutSale[]) {
  return sales.slice(0, 12).map((sale) => {
    const summary = saleSummary(sale) || "Sale"
    return `- ${formatDateTime(sale.createdAt)} / ${paymentLabel(sale.paymentMethod)} / ${formatPrice(sale.total)} / ${summary}`
  }).join("\n")
}

function cashVarianceLabel(value: number) {
  if (value > 0) return `+${formatPrice(value)}`
  if (value < 0) return `-${formatPrice(Math.abs(value))}`
  return formatPrice(0)
}

function supplierBalanceLabel(item: CloseoutReport["supplierOutstandingBreakdown"][number]) {
  if (item.outstandingDebt > 0) return `${formatPrice(item.outstandingDebt)} owed`
  if (item.supplierCredit > 0) return `${formatPrice(item.supplierCredit)} credit`
  return "Settled"
}

function reportText(report: CloseoutReport, cash: ReturnType<typeof calculatePosCashReconciliation>, notes: string) {
  const paymentLines = report.paymentBreakdown.map((item) => `- ${item.label}: ${formatPrice(item.total)} (${item.count} sales)`).join("\n")
  const categoryLines = report.categoryBreakdown.map((item) => `- ${item.label}: ${formatPrice(item.total)} (${item.quantity} items)`).join("\n")
  const operatorLines = report.operatorBreakdown.map((item) => `- ${item.label}: ${formatPrice(item.total)} (${item.count} sales)`).join("\n")
  const saleLines = detailedSaleLines(report.paidSales)
  const cashExpenseLines = cash.cashExpenseItems.map((expense) => `- ${expense.description}: -${formatPrice(expense.amount)}`).join("\n")
  const supplierBalanceLines = report.supplierOutstandingBreakdown.map((item) => `- ${item.supplierName}: ${supplierBalanceLabel(item)}`).join("\n")
  const supplierActivityLines = report.supplierBreakdown.map((item) => `- ${item.supplierName}: bills ${formatPrice(item.billsTotal)}, payments -${formatPrice(item.paymentsTotal)}, net change ${formatPrice(item.netChange)}`).join("\n")

  return [
    `Backus Ceramics POS closeout`,
    `Day code: ${report.businessDate}`,
    `Business date: ${report.businessDate}`,
    ``,
    `Summary`,
    `- Paid sales: ${report.saleCount}`,
    `- Items sold: ${report.itemCount}`,
    `- Gross subtotal: ${formatPrice(report.grossSubtotal)}`,
    `- Discounts: -${formatPrice(report.discountTotal)}`,
    `- Tax: ${formatPrice(report.taxTotal)}`,
    `- Net collected: ${formatPrice(report.netTotal)}`,
    `- Voided: ${report.voidedSaleCount} / ${formatPrice(report.voidedTotal)}`,
    `- Pending online: ${report.pendingSaleCount} / ${formatPrice(report.pendingTotal)}`,
    ``,
    `Payment methods`,
    paymentLines || "- None",
    ``,
    `Cash reconciliation`,
    `- Opening register cash: ${formatPrice(cash.openingCash)}`,
    `- Cash sales: ${formatPrice(cash.cashSales)}`,
    cashExpenseLines,
    `- Cash expenses total: -${formatPrice(cash.cashExpenses)}`,
    `- Logged register cash outs: -${formatPrice(cash.registerCashOuts)}`,
    `- Cash supplier payments: -${formatPrice(cash.supplierCashPayments)}`,
    `- Expected closing cash: ${formatPrice(cash.expectedClosingCash)}`,
    `- Counted closing cash: ${formatPrice(cash.closingCash)}`,
    `- Over / short: ${cashVarianceLabel(cash.cashVariance)}`,
    `- Staff-funded purchases: ${formatPrice(report.staffFundedTotal)}`,
    `- Staff reimbursed: ${formatPrice(report.staffReimbursedTotal)}`,
    `- Outstanding staff debt: ${formatPrice(report.outstandingStaffDebt)}`,
    ``,
    `Categories`,
    categoryLines || "- None",
    ``,
    `Supplier accounts`,
    `- Bills received: ${report.supplierBillCount} / ${formatPrice(report.supplierBillsTotal)}`,
    `- Payments made: ${report.supplierPaymentCount} / ${formatPrice(report.supplierPaymentsTotal)}`,
    `- Current supplier debt: ${formatPrice(report.supplierOutstanding)}`,
    report.supplierCredit > 0 ? `- Supplier credit: ${formatPrice(report.supplierCredit)}` : "",
    supplierBalanceLines || "- No supplier balances",
    `Activity this day`,
    supplierActivityLines || "- No supplier activity",
    ``,
    `Operators`,
    operatorLines || "- None",
    ``,
    `Sales detail${report.paidSales.length > 12 ? ` (first 12 of ${report.paidSales.length})` : ""}`,
    saleLines || "- None",
    notes.trim() ? `\nNotes\n${notes.trim()}` : "",
  ].filter(Boolean).join("\n")
}

function BreakdownTable({ title, items, countLabel }: { title: string; items: Breakdown[]; countLabel: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity for this day.</p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {countLabel}: {countLabel === "items" ? item.quantity : item.count}
                  </p>
                </div>
                <div className="hidden text-right text-xs text-muted-foreground sm:block">
                  {item.tax > 0 && <p>Tax {formatPrice(item.tax)}</p>}
                  {item.discount > 0 && <p>Discount -{formatPrice(item.discount)}</p>}
                </div>
                <p className="text-right font-semibold text-foreground">{formatPrice(item.total)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function PosCloseoutPage() {
  const lastSessionRefreshRef = useRef(Date.now())
  const [dateKey, setDateKey] = useState(todayInBali())
  const [report, setReport] = useState<CloseoutReport | null>(null)
  const [closeout, setCloseout] = useState<CloseoutRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [closing, setClosing] = useState(false)
  const [emailReport, setEmailReport] = useState(true)
  const [reportEmail, setReportEmail] = useState("")
  const [notes, setNotes] = useState("")
  const [openingCash, setOpeningCash] = useState("0")
  const [closingCash, setClosingCash] = useState("0")
  const [cashExpenses, setCashExpenses] = useState<CashExpenseDraft[]>([])
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const cashSales = report?.paymentBreakdown.find((item) => item.key === "CASH")?.total || 0
  const parsedCashExpenses = useMemo<PosCashExpense[]>(() => cashExpenses.map((expense) => ({
    description: expense.description.trim(),
    amount: Math.max(0, Math.round(Number(expense.amount) || 0)),
  })).filter((expense) => expense.description || expense.amount > 0), [cashExpenses])
  const cashReconciliation = useMemo(() => calculatePosCashReconciliation({
    openingCash: Math.max(0, Math.round(Number(openingCash) || 0)),
    cashSales,
    closingCash: Math.max(0, Math.round(Number(closingCash) || 0)),
    cashExpenseItems: parsedCashExpenses,
    supplierCashPayments: report?.supplierCashPayments || 0,
    registerCashOuts: report?.registerCashOutTotal || 0,
  }), [cashSales, closingCash, openingCash, parsedCashExpenses, report?.registerCashOutTotal, report?.supplierCashPayments])
  const hasInvalidExpense = cashExpenses.some((expense) => !expense.description.trim() && Number(expense.amount) > 0)
  const canClose = Boolean(report && !closing && !hasInvalidExpense)
  const reportCopy = useMemo(() => report ? reportText(report, cashReconciliation, notes) : "", [cashReconciliation, report, notes])
  const whatsappReportUrl = useMemo(() => {
    if (!reportCopy) return "#"
    return `https://wa.me/${WHATSAPP_REPORT_NUMBER}?text=${encodeURIComponent(reportCopy)}`
  }, [reportCopy])

  useEffect(() => {
    void fetchCloseout(dateKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let refreshInFlight = false

    const refreshOperatorSession = () => {
      const now = Date.now()
      if (refreshInFlight || now - lastSessionRefreshRef.current < 60_000) return

      refreshInFlight = true
      lastSessionRefreshRef.current = now
      void fetch("/api/pos/pin/verify", { cache: "no-store" })
        .then((res) => {
          if (res.status !== 423) return
          window.location.assign(`/admin/pos?returnTo=${encodeURIComponent("/admin/pos/closeout?posFullscreen=1")}`)
        })
        .catch((sessionError) => {
          console.error("Could not refresh POS operator session", sessionError)
        })
        .finally(() => {
          refreshInFlight = false
        })
    }

    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"]
    activityEvents.forEach((eventName) => window.addEventListener(eventName, refreshOperatorSession, { passive: true }))
    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, refreshOperatorSession))
    }
  }, [])

  const fetchCloseout = async (date = dateKey) => {
    setError("")
    setSuccess("")
    setRefreshing(true)
    try {
      const res = await fetch(`/api/pos/closeout?date=${encodeURIComponent(date)}`)
      const data = await res.json().catch(() => ({}))
      if (res.status === 423 && data.code === "POS_PIN_LOCKED") {
        window.location.assign(`/admin/pos?returnTo=${encodeURIComponent("/admin/pos/closeout?posFullscreen=1")}`)
        return
      }
      if (!res.ok) throw new Error(data.error || "Could not load closeout report")

      setReport(data.report)
      setCloseout(data.closeout)
      setNotes(data.closeout?.notes || "")
      setOpeningCash(String(data.closeout?.openingCash || 0))
      setClosingCash(String(data.closeout?.closingCash || 0))
      try {
        const savedExpenses = data.closeout?.cashExpenseItems ? JSON.parse(data.closeout.cashExpenseItems) : []
        setCashExpenses(Array.isArray(savedExpenses) ? savedExpenses.map((expense: PosCashExpense, index: number) => ({
          id: `${date}-${index}-${expense.description}`,
          description: expense.description || "",
          amount: String(expense.amount || 0),
        })) : [])
      } catch {
        setCashExpenses([])
      }
    } catch (loadError) {
      console.error("Could not load POS closeout", loadError)
      setError(loadError instanceof Error ? loadError.message : "Could not load closeout report.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const closeDay = async () => {
    if (!report) return
    setClosing(true)
    setError("")
    setSuccess("")

    try {
      const res = await fetch("/api/pos/closeout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateKey,
          notes,
          emailReport,
          reportEmail,
          openingCash: cashReconciliation.openingCash,
          closingCash: cashReconciliation.closingCash,
          cashExpenseItems: cashReconciliation.cashExpenseItems,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 423 && data.code === "POS_PIN_LOCKED") {
        window.location.assign(`/admin/pos?returnTo=${encodeURIComponent("/admin/pos/closeout?posFullscreen=1")}`)
        return
      }
      if (!res.ok) throw new Error(data.error || "Could not close out this day")

      setReport(data.report)
      setCloseout(data.closeout)
      setSuccess(data.emailSent ? "Day closed and report email sent." : "Day closed. Report is saved below.")
    } catch (closeError) {
      console.error("Could not close POS day", closeError)
      setError(closeError instanceof Error ? closeError.message : "Could not close out this day.")
    } finally {
      setClosing(false)
    }
  }

  const copyReport = async () => {
    if (!reportCopy || typeof navigator === "undefined") return
    try {
      await navigator.clipboard.writeText(reportCopy)
      setSuccess("Closeout report copied.")
    } catch (copyError) {
      console.error("Could not copy closeout report", copyError)
      setError("Could not copy the report from this browser.")
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-30 -mx-2 flex flex-col gap-3 border-b border-border bg-muted/95 px-2 py-3 backdrop-blur sm:-mx-3 sm:px-3 lg:-mx-4 lg:flex-row lg:items-center lg:justify-between lg:px-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Close Out Day</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review POS accounting, save the closeout, and send the day report.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/pos/closeout/week?posFullscreen=1">
              <CalendarDays className="mr-2 h-4 w-4" />
              Weekly closeout
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/pos?posFullscreen=1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to POS
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => fetchCloseout(dateKey)} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}

      <Card>
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="businessDate" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Business date
            </Label>
            <Input
              id="businessDate"
              type="date"
              value={dateKey}
              onChange={(event) => {
                const nextDate = event.target.value || todayInBali()
                setDateKey(nextDate)
                void fetchCloseout(nextDate)
              }}
            />
          </div>

          <div className="rounded-md border border-border bg-muted/35 p-3">
            {closeout ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge className="bg-green-100 text-green-800">Closed</Badge>
                  <span>{formatDateTime(closeout.closedAt)}</span>
                  <span>by {closeout.closedBy?.name || closeout.closedBy?.email || "staff"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Day code <span className="font-mono font-semibold text-foreground">{closeout.businessDate}</span>
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">Open</Badge>
                  <span>This date has not been closed yet.</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Day code <span className="font-mono font-semibold text-foreground">{dateKey}</span>
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button type="button" variant="outline" onClick={copyReport} disabled={!report}>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button type="button" variant="outline" onClick={() => window.print()} disabled={!report}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button asChild type="button" variant="outline" className={!report ? "pointer-events-none opacity-50" : ""}>
              <a href={whatsappReportUrl} target="_blank" rel="noopener noreferrer" aria-disabled={!report}>
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Net collected</p>
                <p className="mt-1 font-heading text-2xl font-bold text-foreground">{formatPrice(report.netTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Paid sales</p>
                <p className="mt-1 font-heading text-2xl font-bold text-foreground">{report.saleCount}</p>
                <p className="text-xs text-muted-foreground">{report.itemCount} items sold</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Tax collected</p>
                <p className="mt-1 font-heading text-2xl font-bold text-foreground">{formatPrice(report.taxTotal)}</p>
                <p className="text-xs text-muted-foreground">Discounts -{formatPrice(report.discountTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Voids / pending</p>
                <p className="mt-1 font-heading text-2xl font-bold text-foreground">{report.voidedSaleCount} voided</p>
                <p className="text-xs text-muted-foreground">{report.pendingSaleCount} pending online</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <BreakdownTable title="Payment Methods" items={report.paymentBreakdown} countLabel="sales" />
                <BreakdownTable title="Categories" items={report.categoryBreakdown} countLabel="items" />
              </div>
              <BreakdownTable title="Operators" items={report.operatorBreakdown} countLabel="sales" />

              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle className="font-heading text-xl">Cash Outs & Staff Debt</CardTitle><CardDescription>Entries recorded from the POS during this business date.</CardDescription></div><Button asChild size="sm" variant="outline"><Link href="/admin/pos/cash-outs?posFullscreen=1">Open ledger</Link></Button></CardHeader>
                <CardContent className="space-y-3"><div className="grid grid-cols-3 gap-2 text-sm"><div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Register out</p><p className="font-semibold">{formatPrice(report.registerCashOutTotal)}</p></div><div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Staff funded</p><p className="font-semibold">{formatPrice(report.staffFundedTotal)}</p></div><div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Still owed</p><p className="font-semibold">{formatPrice(report.outstandingStaffDebt)}</p></div></div>{report.cashOutEntries.length ? <div className="divide-y divide-border">{report.cashOutEntries.map((entry) => <div key={entry.id} className="flex items-start justify-between gap-3 py-2 text-sm"><div><p className="font-medium">{entry.description}</p><p className="text-xs text-muted-foreground">{entry.fundingSource === "REGISTER" ? "Register cash" : `Staff paid · ${entry.staffMember?.name || entry.staffMember?.email || "Staff"}`}</p></div><p className="font-semibold">{formatPrice(entry.amount)}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No cash outs for this date.</p>}</CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle className="font-heading text-xl">Supplier Accounts</CardTitle><CardDescription>Bills and payments recorded on this business date.</CardDescription></div><Button asChild size="sm" variant="outline"><Link href="/admin/pos/suppliers?posFullscreen=1">Open ledger</Link></Button></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Bills today</p><p className="font-semibold">{formatPrice(report.supplierBillsTotal)}</p></div><div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Payments today</p><p className="font-semibold">{formatPrice(report.supplierPaymentsTotal)}</p></div><div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Current debt</p><p className="font-semibold">{formatPrice(report.supplierOutstanding)}</p></div><div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Supplier credit</p><p className="font-semibold">{formatPrice(report.supplierCredit)}</p></div></div>
                  {report.supplierOutstandingBreakdown.length ? <div><p className="pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current balance by outlet</p><div className="divide-y divide-border">{report.supplierOutstandingBreakdown.map((supplier) => <div key={supplier.supplierId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2 text-sm"><div><p className="font-medium">{supplier.supplierName}</p><p className="text-xs text-muted-foreground">All bills {formatPrice(supplier.billsTotal)} · All payments {formatPrice(supplier.paymentsTotal)}</p></div><p className="font-semibold">{supplierBalanceLabel(supplier)}</p></div>)}</div></div> : <p className="text-sm text-muted-foreground">No supplier balances recorded.</p>}
                  {report.supplierBreakdown.length > 0 && <p className="text-xs text-muted-foreground">Today: {report.supplierBreakdown.map((supplier) => `${supplier.supplierName} ${supplier.netChange >= 0 ? "+" : "-"}${formatPrice(Math.abs(supplier.netChange))}`).join(" · ")}</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-heading text-xl">Sales Included</CardTitle>
                  <CardDescription>Paid POS sales created on this business date.</CardDescription>
                </CardHeader>
                <CardContent>
                  {report.paidSales.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No paid sales for this date.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {report.paidSales.map((sale) => (
                        <div key={sale.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{formatDateTime(sale.createdAt)} · {paymentLabel(sale.paymentMethod)}</p>
                            <p className="truncate text-muted-foreground">{saleSummary(sale)}</p>
                          </div>
                          <p className="font-semibold text-foreground sm:text-right">{formatPrice(sale.total)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {(report.voidedSales.length > 0 || report.pendingSales.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading text-xl">Exceptions</CardTitle>
                    <CardDescription>Voids and pending online payments that need attention.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {report.voidedSales.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-semibold text-foreground">Voided sales</p>
                        <div className="divide-y divide-border rounded-md border border-border">
                          {report.voidedSales.map((sale) => (
                            <div key={sale.id} className="p-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span>{formatDateTime(sale.voidedAt || sale.createdAt)}</span>
                                <span className="font-semibold">{formatPrice(sale.total)}</span>
                              </div>
                              {sale.voidReason && <p className="mt-1 text-muted-foreground">{sale.voidReason}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {report.pendingSales.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-semibold text-foreground">Pending online payments</p>
                        <div className="divide-y divide-border rounded-md border border-border">
                          {report.pendingSales.map((sale) => (
                            <div key={sale.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                              <span>{formatDateTime(sale.createdAt)} · {saleSummary(sale)}</span>
                              <span className="font-semibold">{formatPrice(sale.total)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-heading text-xl">
                  <ShieldCheck className="h-5 w-5" />
                  Finalize Closeout
                </CardTitle>
                <CardDescription>
                  Save the accounting snapshot after the register, machine, QRIS, and transfer totals match.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md bg-muted/45 p-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Gross subtotal</span>
                    <span>{formatPrice(report.grossSubtotal)}</span>
                  </div>
                  {report.discountTotal > 0 && (
                    <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                      <span>Discounts</span>
                      <span>-{formatPrice(report.discountTotal)}</span>
                    </div>
                  )}
                  {report.taxTotal > 0 && (
                    <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                      <span>Tax</span>
                      <span>{formatPrice(report.taxTotal)}</span>
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between text-xl font-bold text-foreground">
                    <span>Net collected</span>
                    <span>{formatPrice(report.netTotal)}</span>
                  </div>
                </div>

                <div className="space-y-4 rounded-md border border-border p-4">
                  <div>
                    <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
                      <Banknote className="h-5 w-5" />
                      Cash reconciliation
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Count the physical register cash. Cash sales are added automatically; expenses and cash supplier payments are deducted.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="openingCash">Cash at start of day</Label>
                      <Input
                        id="openingCash"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1000}
                        value={openingCash}
                        onChange={(event) => setOpeningCash(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="closingCash">Cash counted at end</Label>
                      <Input
                        id="closingCash"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1000}
                        value={closingCash}
                        onChange={(event) => setClosingCash(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Cash expenses</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setCashExpenses((current) => [...current, {
                          id: `${Date.now()}-${current.length}`,
                          description: "",
                          amount: "",
                        }])}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Add expense
                      </Button>
                    </div>
                    {cashExpenses.length === 0 ? (
                      <p className="rounded-md bg-muted/35 px-3 py-2 text-xs text-muted-foreground">No cash expenses recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {cashExpenses.map((expense) => (
                          <div key={expense.id} className="grid grid-cols-[minmax(0,1fr)_120px_36px] gap-2">
                            <Input
                              aria-label="Cash expense description"
                              value={expense.description}
                              maxLength={160}
                              placeholder="Expense description"
                              onChange={(event) => setCashExpenses((current) => current.map((item) => (
                                item.id === expense.id ? { ...item, description: event.target.value } : item
                              )))}
                            />
                            <Input
                              aria-label="Cash expense amount in IDR"
                              type="number"
                              inputMode="numeric"
                              min={0}
                              step={1000}
                              value={expense.amount}
                              placeholder="IDR"
                              onChange={(event) => setCashExpenses((current) => current.map((item) => (
                                item.id === expense.id ? { ...item, amount: event.target.value } : item
                              )))}
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label="Remove cash expense"
                              onClick={() => setCashExpenses((current) => current.filter((item) => item.id !== expense.id))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {hasInvalidExpense && <p className="text-xs text-destructive">Add a description for every cash expense.</p>}
                  </div>

                  <div className="space-y-1 border-t border-border pt-3 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Cash sales</span>
                      <span>{formatPrice(cashReconciliation.cashSales)}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Cash expenses</span>
                      <span>-{formatPrice(cashReconciliation.cashExpenses)}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Logged cash outs</span>
                      <span>-{formatPrice(cashReconciliation.registerCashOuts)}</span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Cash supplier payments</span>
                      <span>-{formatPrice(report.supplierCashPayments)}</span>
                    </div>
                    <div className="flex items-center justify-between font-semibold text-foreground">
                      <span>Expected closing cash</span>
                      <span>{formatPrice(cashReconciliation.expectedClosingCash)}</span>
                    </div>
                    <div className={`flex items-center justify-between font-semibold ${cashReconciliation.cashVariance === 0 ? "text-green-700" : "text-destructive"}`}>
                      <span>Over / short</span>
                      <span>{cashVarianceLabel(cashReconciliation.cashVariance)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="closeoutNotes">Closeout notes</Label>
                  <Textarea
                    id="closeoutNotes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    placeholder="Cash counted, machine batch number, transfer notes, or unusual corrections"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
                  <div>
                    <Label htmlFor="emailReport" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email report
                    </Label>
                    <p className="text-xs text-muted-foreground">Sends after the day is closed.</p>
                  </div>
                  <Switch id="emailReport" checked={emailReport} onCheckedChange={setEmailReport} />
                </div>

                {emailReport && (
                  <div className="space-y-2">
                    <Label htmlFor="reportEmail">Report email</Label>
                    <Input
                      id="reportEmail"
                      type="email"
                      value={reportEmail}
                      onChange={(event) => setReportEmail(event.target.value)}
                      placeholder="Defaults to your login email"
                    />
                  </div>
                )}

                <Button className="h-12 w-full text-base" onClick={closeDay} disabled={!canClose}>
                  {closing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                  {closeout ? "Re-close day with current report" : "Close out this day"}
                </Button>

                {closeout && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Re-closing replaces the saved snapshot for this business date. Use it if a correction or void was recorded after the first closeout.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
