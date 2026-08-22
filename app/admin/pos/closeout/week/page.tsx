"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarRange, CheckCircle2, Copy, Loader2, Mail, MessageCircle, Printer, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { formatPrice } from "@/lib/pos-catalog"

const BALI_OFFSET = 8 * 60 * 60 * 1000
const WHATSAPP_REPORT_NUMBER = "6282145890402"

interface Breakdown { key: string; label: string; count: number; quantity: number; total: number }
interface DailySales { businessDate: string; saleCount: number; itemCount: number; netTotal: number }
interface DailyCash { businessDate: string; openingCash: number; cashSales: number; cashExpenses: number; registerCashOuts: number; supplierCashPayments: number; expectedClosingCash: number; closingCash: number; cashVariance: number; closedAt: string }
interface WeeklyReport {
  weekStart: string; weekEnd: string; weekCode: string; saleCount: number; itemCount: number
  grossSubtotal: number; discountTotal: number; taxTotal: number; netTotal: number
  voidedSaleCount: number; voidedTotal: number; pendingSaleCount: number; pendingTotal: number
  paymentBreakdown: Breakdown[]; categoryBreakdown: Breakdown[]; operatorBreakdown: Breakdown[]
  dailyBreakdown: DailySales[]; dailyCashBreakdown: DailyCash[]; missingDailyCloseouts: string[]
  supplierBillCount: number; supplierBillsTotal: number; supplierPaymentCount: number; supplierPaymentsTotal: number
  supplierNetChange: number; supplierOutstanding: number
  supplierCredit: number
  supplierBreakdown: Array<{ supplierId: string; supplierName: string; billCount: number; billsTotal: number; paymentCount: number; paymentsTotal: number; netChange: number }>
  supplierOutstandingBreakdown: Array<{ supplierId: string; supplierName: string; billCount: number; billsTotal: number; paymentCount: number; paymentsTotal: number; netChange: number; outstandingDebt: number; supplierCredit: number }>
  registerCashOutTotal: number; staffFundedTotal: number; staffReimbursedTotal: number; outstandingStaffDebt: number
}
interface CloseoutRecord { id: string; weekStart: string; weekEnd: string; closedAt: string; notes: string | null; closedBy: { name: string | null; email: string | null } | null }

function todayBali() { return new Date(Date.now() + BALI_OFFSET).toISOString().slice(0, 10) }
function readableDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}
function signedPrice(value: number) {
  if (value > 0) return `+${formatPrice(value)}`
  if (value < 0) return `-${formatPrice(Math.abs(value))}`
  return formatPrice(0)
}

function supplierBalanceLabel(item: WeeklyReport["supplierOutstandingBreakdown"][number]) {
  if (item.outstandingDebt > 0) return `${formatPrice(item.outstandingDebt)} owed`
  if (item.supplierCredit > 0) return `${formatPrice(item.supplierCredit)} credit`
  return "Settled"
}

function weeklyReportText(report: WeeklyReport, notes: string) {
  const cashByDate = new Map(report.dailyCashBreakdown.map((day) => [day.businessDate, day]))
  const dayLines = report.dailyBreakdown.map((day) => {
    const cash = cashByDate.get(day.businessDate)
    return `- ${readableDate(day.businessDate)}: ${day.saleCount} sales / ${day.itemCount} items / ${formatPrice(day.netTotal)} / cash ${cash ? signedPrice(cash.cashVariance) : "not closed"}`
  })
  const breakdown = (items: Breakdown[], unit: "sales" | "items") => items.map((item) => `- ${item.label}: ${formatPrice(item.total)} (${unit === "sales" ? item.count : item.quantity} ${unit})`).join("\n") || "- None"
  return [
    "Backus Ceramics weekly POS closeout",
    `Week code: ${report.weekCode}`,
    `Monday ${report.weekStart} - Saturday ${report.weekEnd}`,
    "",
    "Summary",
    `- Paid sales: ${report.saleCount}`,
    `- Items sold: ${report.itemCount}`,
    `- Gross subtotal: ${formatPrice(report.grossSubtotal)}`,
    `- Discounts: -${formatPrice(report.discountTotal)}`,
    `- Tax: ${formatPrice(report.taxTotal)}`,
    `- Net collected: ${formatPrice(report.netTotal)}`,
    `- Voided: ${report.voidedSaleCount} / ${formatPrice(report.voidedTotal)}`,
    `- Pending online: ${report.pendingSaleCount} / ${formatPrice(report.pendingTotal)}`,
    "",
    "Daily activity",
    ...dayLines,
    "",
    `Missing daily cash closeouts: ${report.missingDailyCloseouts.join(", ") || "None"}`,
    `Register cash outs: -${formatPrice(report.registerCashOutTotal)}`,
    `Staff-funded purchases: ${formatPrice(report.staffFundedTotal)}`,
    `Staff reimbursed: ${formatPrice(report.staffReimbursedTotal)}`,
    `Outstanding staff debt: ${formatPrice(report.outstandingStaffDebt)}`,
    "",
    "Payment methods",
    breakdown(report.paymentBreakdown, "sales"),
    "",
    "Categories",
    breakdown(report.categoryBreakdown, "items"),
    "",
    "Operators",
    breakdown(report.operatorBreakdown, "sales"),
    "",
    "Supplier accounts",
    `- Bills received: ${report.supplierBillCount} / ${formatPrice(report.supplierBillsTotal)}`,
    `- Payments made: ${report.supplierPaymentCount} / ${formatPrice(report.supplierPaymentsTotal)}`,
    `- Current supplier debt: ${formatPrice(report.supplierOutstanding)}`,
    report.supplierCredit > 0 ? `- Supplier credit: ${formatPrice(report.supplierCredit)}` : "",
    ...report.supplierOutstandingBreakdown.map((item) => `- ${item.supplierName}: ${supplierBalanceLabel(item)}`),
    "Activity this week",
    ...report.supplierBreakdown.map((item) => `- ${item.supplierName}: bills ${formatPrice(item.billsTotal)}, payments -${formatPrice(item.paymentsTotal)}, net change ${formatPrice(item.netChange)}`),
    notes.trim() ? `\nNotes\n${notes.trim()}` : "",
  ].filter(Boolean).join("\n")
}

function BreakdownList({ title, items, unit }: { title: string; items: Breakdown[]; unit: "sales" | "items" }) {
  return <Card><CardHeader><CardTitle className="font-heading text-xl">{title}</CardTitle></CardHeader><CardContent>
    {items.length ? <div className="divide-y divide-border">{items.map((item) => <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 text-sm"><div><p className="font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{unit === "sales" ? item.count : item.quantity} {unit}</p></div><p className="font-semibold">{formatPrice(item.total)}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No activity this week.</p>}
  </CardContent></Card>
}

export default function WeeklyPosCloseoutPage() {
  const [dateKey, setDateKey] = useState(todayBali())
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [closeout, setCloseout] = useState<CloseoutRecord | null>(null)
  const [notes, setNotes] = useState("")
  const [reportEmail, setReportEmail] = useState("")
  const [emailReport, setEmailReport] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const reportCopy = useMemo(() => report ? weeklyReportText(report, notes) : "", [report, notes])
  const cashByDate = useMemo(() => new Map(report?.dailyCashBreakdown.map((day) => [day.businessDate, day]) || []), [report])
  const whatsappUrl = `https://wa.me/${WHATSAPP_REPORT_NUMBER}?text=${encodeURIComponent(reportCopy)}`

  const loadReport = async (date = dateKey) => {
    setError(""); setSuccess("")
    try {
      const res = await fetch(`/api/pos/closeout/week?date=${encodeURIComponent(date)}`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (res.status === 423) { window.location.assign(`/admin/pos?returnTo=${encodeURIComponent("/admin/pos/closeout/week?posFullscreen=1")}`); return }
      if (!res.ok) throw new Error(data.error || "Could not load weekly closeout")
      setReport(data.report); setCloseout(data.closeout); setNotes(data.closeout?.notes || ""); setDateKey(data.report.weekEnd)
    } catch (loadError) {
      console.error("Could not load weekly POS closeout", loadError)
      setError(loadError instanceof Error ? loadError.message : "Could not load weekly closeout.")
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadReport() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const closeWeek = async () => {
    if (!report) return
    setSaving(true); setError(""); setSuccess("")
    try {
      const res = await fetch("/api/pos/closeout/week", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: dateKey, notes, emailReport, reportEmail }) })
      const data = await res.json().catch(() => ({}))
      if (res.status === 423) { window.location.assign(`/admin/pos?returnTo=${encodeURIComponent("/admin/pos/closeout/week?posFullscreen=1")}`); return }
      if (!res.ok) throw new Error(data.error || "Could not close out this week")
      setReport(data.report); setCloseout(data.closeout)
      setSuccess(data.emailSent ? "Week closed and report email sent." : "Week closed. The report is saved below.")
    } catch (saveError) {
      console.error("Could not close POS week", saveError)
      setError(saveError instanceof Error ? saveError.message : "Could not close out this week.")
    } finally { setSaving(false) }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return <div className="space-y-4">
    <div className="sticky top-0 z-30 -mx-2 flex flex-col gap-3 border-b border-border bg-muted/95 px-2 py-3 backdrop-blur sm:-mx-3 sm:px-3 lg:-mx-4 lg:flex-row lg:items-center lg:justify-between lg:px-4">
      <div><h1 className="font-heading text-2xl font-bold">Close Out Week</h1><p className="mt-1 text-sm text-muted-foreground">Finalize Monday through Saturday after Saturday&apos;s daily closeout.</p></div>
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/admin/pos?posFullscreen=1"><ArrowLeft className="mr-2 h-4 w-4" />POS</Link></Button><Button asChild variant="outline"><Link href="/admin/pos/closeout?posFullscreen=1"><CalendarRange className="mr-2 h-4 w-4" />Daily closeout</Link></Button><Button variant="outline" onClick={() => loadReport()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
    </div>
    {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    {success && <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />{success}</div>}
    <Card><CardContent className="grid gap-4 p-4 lg:grid-cols-[230px_minmax(0,1fr)_auto] lg:items-end">
      <div className="space-y-2"><Label htmlFor="weekDate">Week ending Saturday</Label><Input id="weekDate" type="date" value={dateKey} onChange={(event) => { const date = event.target.value || todayBali(); setDateKey(date); void loadReport(date) }} /></div>
      <div className="rounded-md border border-border bg-muted/35 p-3 text-sm">{report && <><p className="font-medium">Monday {readableDate(report.weekStart)} through Saturday {readableDate(report.weekEnd)}</p><p className="mt-1 text-xs text-muted-foreground">Week code <span className="font-mono">{report.weekCode}</span></p>{closeout && <p className="mt-2 text-xs text-green-700">Closed by {closeout.closedBy?.name || closeout.closedBy?.email || "staff"}</p>}</>}</div>
      <div className="flex flex-wrap gap-2 lg:justify-end"><Button variant="outline" onClick={() => navigator.clipboard.writeText(reportCopy).then(() => setSuccess("Weekly report copied."))}><Copy className="mr-2 h-4 w-4" />Copy</Button><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button><Button asChild variant="outline"><a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</a></Button></div>
    </CardContent></Card>
    {report && <>
      {report.missingDailyCloseouts.length > 0 && <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Cash reconciliation is incomplete</p><p>Daily closeouts are missing for {report.missingDailyCloseouts.map(readableDate).join(", ")}. Sales totals remain complete, but close those days before finalizing when possible.</p></div></div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Net collected", formatPrice(report.netTotal)], ["Paid sales", `${report.saleCount}`], ["Items sold", `${report.itemCount}`], ["Tax collected", formatPrice(report.taxTotal)]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 font-heading text-2xl font-bold">{value}</p></CardContent></Card>)}</div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]"><div className="space-y-4">
        <Card><CardHeader><CardTitle className="font-heading text-xl">Monday–Saturday Activity</CardTitle><CardDescription>Sales come directly from completed POS transactions. Cash figures come from each saved daily closeout.</CardDescription></CardHeader><CardContent className="space-y-2">{report.dailyBreakdown.map((day) => { const cash = cashByDate.get(day.businessDate); return <div key={day.businessDate} className="grid gap-2 rounded-md border border-border p-3 text-sm sm:grid-cols-[minmax(140px,1fr)_auto_auto_auto] sm:items-center"><div><p className="font-medium">{readableDate(day.businessDate)}</p><p className="text-xs text-muted-foreground">{day.saleCount} sales · {day.itemCount} items{cash?.registerCashOuts ? ` · cash out ${formatPrice(cash.registerCashOuts)}` : ""}</p></div><p className="font-semibold sm:text-right">{formatPrice(day.netTotal)}</p><p className="text-xs text-muted-foreground sm:text-right">{cash ? `Cash counted ${formatPrice(cash.closingCash)}` : "Daily closeout missing"}</p><Badge variant="outline" className="w-fit">{cash ? `Variance ${signedPrice(cash.cashVariance)}` : "Not closed"}</Badge></div>})}</CardContent></Card>
        <Card><CardHeader><CardTitle className="font-heading text-xl">Cash Outs & Staff Reimbursements</CardTitle><CardDescription>Drawer outflows and business debt owed to staff for this week.</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div><p className="text-xs text-muted-foreground">Register cash out</p><p className="font-semibold">{formatPrice(report.registerCashOutTotal)}</p></div><div><p className="text-xs text-muted-foreground">Staff funded</p><p className="font-semibold">{formatPrice(report.staffFundedTotal)}</p></div><div><p className="text-xs text-muted-foreground">Reimbursed</p><p className="font-semibold">{formatPrice(report.staffReimbursedTotal)}</p></div><div><p className="text-xs text-muted-foreground">Still owed</p><p className="font-semibold">{formatPrice(report.outstandingStaffDebt)}</p></div></CardContent></Card>
        <div className="grid gap-4 lg:grid-cols-2"><BreakdownList title="Payment Methods" items={report.paymentBreakdown} unit="sales" /><BreakdownList title="Categories" items={report.categoryBreakdown} unit="items" /></div><BreakdownList title="Operators" items={report.operatorBreakdown} unit="sales" />
        <Card><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle className="font-heading text-xl">Supplier Accounts</CardTitle><CardDescription>Current outlet balances, with this week&apos;s activity shown separately.</CardDescription></div><Button asChild size="sm" variant="outline"><Link href="/admin/pos/suppliers?posFullscreen=1">Open ledger</Link></Button></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Bills this week</p><p className="font-semibold">{formatPrice(report.supplierBillsTotal)}</p></div><div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Payments this week</p><p className="font-semibold">{formatPrice(report.supplierPaymentsTotal)}</p></div><div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Current debt</p><p className="font-semibold">{formatPrice(report.supplierOutstanding)}</p></div><div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">Supplier credit</p><p className="font-semibold">{formatPrice(report.supplierCredit)}</p></div></div>{report.supplierOutstandingBreakdown.length ? <div><p className="pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current balance by outlet</p><div className="divide-y divide-border">{report.supplierOutstandingBreakdown.map((supplier) => <div key={supplier.supplierId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2 text-sm"><div><p className="font-medium">{supplier.supplierName}</p><p className="text-xs text-muted-foreground">All bills {formatPrice(supplier.billsTotal)} · All payments {formatPrice(supplier.paymentsTotal)}</p></div><p className="font-semibold">{supplierBalanceLabel(supplier)}</p></div>)}</div></div> : <p className="text-sm text-muted-foreground">No supplier balances recorded.</p>}{report.supplierBreakdown.length > 0 && <p className="text-xs text-muted-foreground">This week: {report.supplierBreakdown.map((supplier) => `${supplier.supplierName} ${supplier.netChange >= 0 ? "+" : "-"}${formatPrice(Math.abs(supplier.netChange))}`).join(" · ")}</p>}</CardContent></Card>
      </div><Card className="h-fit"><CardHeader><CardTitle className="flex items-center gap-2 font-heading text-xl"><ShieldCheck className="h-5 w-5" />Finalize Week</CardTitle><CardDescription>Save a permanent weekly snapshot and send the same detailed report used for daily closeout.</CardDescription></CardHeader><CardContent className="space-y-4">
        <div className="rounded-md bg-muted/45 p-4 text-sm"><div className="flex justify-between"><span>Gross subtotal</span><span>{formatPrice(report.grossSubtotal)}</span></div><div className="mt-1 flex justify-between"><span>Discounts</span><span>-{formatPrice(report.discountTotal)}</span></div><div className="mt-1 flex justify-between"><span>Tax</span><span>{formatPrice(report.taxTotal)}</span></div><div className="mt-3 flex justify-between border-t border-border pt-3 font-bold"><span>Net</span><span>{formatPrice(report.netTotal)}</span></div></div>
        <div className="space-y-2"><Label htmlFor="weeklyNotes">Weekly notes</Label><Textarea id="weeklyNotes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Staffing, discrepancies, stock, or follow-up notes" /></div>
        <div className="flex items-center justify-between rounded-md border border-border p-3"><div><Label htmlFor="weeklyEmail">Email report</Label><p className="text-xs text-muted-foreground">Send after the snapshot is saved.</p></div><Switch id="weeklyEmail" checked={emailReport} onCheckedChange={setEmailReport} /></div>
        {emailReport && <div className="space-y-2"><Label htmlFor="weeklyEmailAddress">Report email</Label><div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="weeklyEmailAddress" type="email" className="pl-9" value={reportEmail} onChange={(event) => setReportEmail(event.target.value)} placeholder="Uses your account email" /></div></div>}
        <Button className="w-full" size="lg" onClick={closeWeek} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Close out this week</Button>
      </CardContent></Card></div>
    </>}
  </div>
}
