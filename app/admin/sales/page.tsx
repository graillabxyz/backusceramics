"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock3,
  CreditCard,
  ExternalLink,
  Gift,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Store,
  Webhook,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatPrice, POS_PAYMENT_METHODS, POS_SALE_STATUSES } from "@/lib/pos-catalog"
import { SALES_CHANNELS, salesChannelLabels, type SalesChannel } from "@/lib/sales-ledger"
import { cn } from "@/lib/utils"

type SaleStatus = (typeof POS_SALE_STATUSES)[number]

interface SaleItem {
  id: string
  nameSnapshot: string
  skuSnapshot: string | null
  categorySnapshot: string
  unitPrice: number
  quantity: number
  subtotal: number
  discountAmount: number
  taxRate: number
  taxAmount: number
  lineTotal: number
}

interface SalePerson {
  id: string
  name: string | null
  email: string | null
}

interface Sale {
  id: string
  channel: SalesChannel
  subtotal: number
  discountTotal: number
  promoCodeSnapshot: string | null
  giftVoucherCodeSnapshot: string | null
  giftVoucherAmount: number
  taxTotal: number
  shippingAmount: number
  total: number
  currency: string
  status: SaleStatus
  paymentMethod: string
  paymentReference: string | null
  paymentSessionId: string | null
  receiptEmail: string | null
  receiptSentAt: string | null
  fulfillmentMethod: string
  fulfilledAt: string | null
  shippingCountry: string | null
  shippingPostalCode: string | null
  shippingCity: string | null
  shippingAddress: string | null
  notes: string | null
  voidedAt: string | null
  voidReason: string | null
  createdAt: string
  items: SaleItem[]
  operator: SalePerson | null
  voidedBy: SalePerson | null
  paymentLink: { id: string; title: string; purpose: string; customerName: string | null; customerEmail: string | null; customerPhone: string | null } | null
  purchasedGiftVoucher: { code: string; token: string; type: string; status: string; recipientName: string | null; purchaserEmail: string } | null
}

interface SalesResponse {
  sales: Sale[]
  totals: Partial<Record<SaleStatus, { count: number; total: number; giftVoucherAmount: number }>>
  nextCursor: string | null
  reconciliation: { checked: number; updated: number; failed: number }
  webhook: { endpoint: string; lastReceived: { event: string | null; status: string | null; receivedAt: string } | null }
}

const statusStyles: Record<SaleStatus, string> = {
  PAID: "border-emerald-300 bg-emerald-50 text-emerald-800",
  PENDING_PAYMENT: "border-amber-300 bg-amber-50 text-amber-900",
  CANCELLED: "border-border bg-muted text-muted-foreground",
  VOIDED: "border-red-300 bg-red-50 text-red-800",
}

const channelStyles: Record<SalesChannel, string> = {
  POS: "border-sky-300 bg-sky-50 text-sky-900",
  WEBSITE: "border-violet-300 bg-violet-50 text-violet-900",
  PAYMENT_LINK: "border-indigo-300 bg-indigo-50 text-indigo-900",
  GIFT_VOUCHER: "border-rose-300 bg-rose-50 text-rose-900",
}

function statusLabel(status: SaleStatus) {
  return status === "PENDING_PAYMENT" ? "Pending payment" : status.charAt(0) + status.slice(1).toLowerCase()
}

function paymentLabel(method: string) {
  return method.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function dateKey(daysAgo = 0) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function rangeStart(range: string) {
  if (range === "TODAY") return dateKey(0)
  if (range === "7D") return dateKey(6)
  if (range === "30D") return dateKey(29)
  if (range === "90D") return dateKey(89)
  return ""
}

function totalFor(totals: SalesResponse["totals"], status: SaleStatus, field: "count" | "total" | "giftVoucherAmount") {
  return totals[status]?.[field] || 0
}

export default function SalesLedgerPage() {
  const [data, setData] = useState<SalesResponse | null>(null)
  const [channel, setChannel] = useState<"ALL" | SalesChannel>("ALL")
  const [status, setStatus] = useState<"ALL" | SaleStatus>("ALL")
  const [paymentMethod, setPaymentMethod] = useState("ALL")
  const [range, setRange] = useState("30D")
  const [queryInput, setQueryInput] = useState("")
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [savingFulfillmentId, setSavingFulfillmentId] = useState("")
  const [error, setError] = useState("")
  const [initialized, setInitialized] = useState(false)

  const fetchSales = useCallback(async ({ cursor, reconcile = false }: { cursor?: string; reconcile?: boolean } = {}) => {
    setError("")
    cursor ? setLoadingMore(true) : reconcile ? setRefreshing(true) : setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "75", channel, status, paymentMethod })
      const from = rangeStart(range)
      if (from) params.set("from", from)
      if (query) params.set("q", query)
      if (cursor) params.set("cursor", cursor)
      if (reconcile) params.set("reconcile", "1")
      const response = await fetch(`/api/admin/sales?${params}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Could not load sales")
      setData((current) => cursor && current ? { ...payload, sales: [...current.sales, ...payload.sales] } : payload)
    } catch (salesError) {
      console.error("Could not load sales ledger", salesError)
      setError(salesError instanceof Error ? salesError.message : "Could not load sales.")
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
    }
  }, [channel, paymentMethod, query, range, status])

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get("q")?.trim() || ""
    if (initialQuery) {
      setQueryInput(initialQuery)
      setQuery(initialQuery)
    }
    setInitialized(true)
  }, [])

  useEffect(() => {
    if (initialized) void fetchSales()
  }, [fetchSales, initialized])

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    setQuery(queryInput.trim())
  }

  const clearFilters = () => {
    setChannel("ALL")
    setStatus("ALL")
    setPaymentMethod("ALL")
    setRange("30D")
    setQueryInput("")
    setQuery("")
  }

  const toggleExpanded = (saleId: string) => setExpanded((current) => {
    const next = new Set(current)
    next.has(saleId) ? next.delete(saleId) : next.add(saleId)
    return next
  })

  const setFulfilled = async (sale: Sale, fulfilled: boolean) => {
    setSavingFulfillmentId(sale.id)
    setError("")
    try {
      const response = await fetch("/api/admin/sales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId: sale.id, fulfilled }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Could not update fulfillment")
      setData((current) => current ? { ...current, sales: current.sales.map((item) => item.id === sale.id ? { ...item, fulfilledAt: payload.sale.fulfilledAt } : item) } : current)
    } catch (fulfillmentError) {
      setError(fulfillmentError instanceof Error ? fulfillmentError.message : "Could not update fulfillment.")
    } finally {
      setSavingFulfillmentId("")
    }
  }

  const metrics = useMemo(() => {
    const totals = data?.totals || {}
    return {
      interactions: POS_SALE_STATUSES.reduce((sum, item) => sum + totalFor(totals, item, "count"), 0),
      paid: totalFor(totals, "PAID", "total"),
      pending: totalFor(totals, "PENDING_PAYMENT", "count"),
      vouchers: totalFor(totals, "PAID", "giftVoucherAmount"),
    }
  }, [data?.totals])

  if (loading && !data) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>

  const lastWebhookAt = data?.webhook.lastReceived?.receivedAt
  const filterActive = channel !== "ALL" || status !== "ALL" || paymentMethod !== "ALL" || range !== "30D" || Boolean(query)

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Central transaction ledger</p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-foreground">Sales</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Website shop, cashier POS, payment-link, and gift-card activity in one expandable history.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/admin/pos/sales"><Store className="mr-2 h-4 w-4" />POS voids</Link></Button>
          <Button type="button" onClick={() => void fetchSales({ reconcile: true })} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Check payments & refresh
          </Button>
        </div>
      </header>

      {error && <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      <section className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Matching transactions", value: metrics.interactions.toLocaleString(), icon: CreditCard },
          { label: "Paid / collected", value: formatPrice(metrics.paid), icon: CheckCircle2 },
          { label: "Pending payment", value: metrics.pending.toLocaleString(), icon: Clock3 },
          { label: "Gift value applied", value: formatPrice(metrics.vouchers), icon: Gift },
        ].map((metric) => <div key={metric.label} className="bg-background p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{metric.label}</p><metric.icon className="h-4 w-4 text-muted-foreground" /></div><p className="mt-2 font-heading text-2xl font-bold text-foreground">{metric.value}</p></div>)}
      </section>

      <section className={cn("flex flex-col gap-3 rounded-md border px-4 py-3 text-sm lg:flex-row lg:items-center lg:justify-between", lastWebhookAt ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-amber-300 bg-amber-50 text-amber-950")}>
        <div className="flex min-w-0 items-start gap-3"><Webhook className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">{lastWebhookAt ? "Verified Xendit callback received" : "No verified callback recorded yet"}</p><p className="mt-0.5 text-xs opacity-80">{lastWebhookAt ? `${data?.webhook.lastReceived?.event || "Payment event"} · ${formatDateTime(lastWebhookAt)}` : "Direct Xendit reconciliation remains available from the refresh button."}</p></div></div>
        <p className="shrink-0 text-xs">Checked {data?.reconciliation.checked || 0} pending · repaired {data?.reconciliation.updated || 0}{(data?.reconciliation.failed || 0) > 0 ? ` · ${data?.reconciliation.failed} need review` : ""}</p>
      </section>

      <section className="rounded-md border border-border bg-background p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_auto] xl:items-end">
          <form onSubmit={submitSearch} className="space-y-2 md:col-span-2 xl:col-span-1">
            <Label htmlFor="sales-search">Search</Label>
            <div className="flex gap-2"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="sales-search" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Customer, item, voucher, or reference" className="pl-9" /></div><Button type="submit" variant="outline">Search</Button></div>
          </form>
          <div className="space-y-2"><Label>Channel</Label><Select value={channel} onValueChange={(value) => setChannel(value as "ALL" | SalesChannel)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All channels</SelectItem>{SALES_CHANNELS.map((item) => <SelectItem key={item} value={item}>{salesChannelLabels[item]}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Status</Label><Select value={status} onValueChange={(value) => setStatus(value as "ALL" | SaleStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All statuses</SelectItem>{POS_SALE_STATUSES.map((item) => <SelectItem key={item} value={item}>{statusLabel(item)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Payment</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All payment methods</SelectItem>{[...POS_PAYMENT_METHODS, "GIFT_VOUCHER"].map((item) => <SelectItem key={item} value={item}>{paymentLabel(item)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Date range</Label><Select value={range} onValueChange={setRange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODAY">Today</SelectItem><SelectItem value="7D">Last 7 days</SelectItem><SelectItem value="30D">Last 30 days</SelectItem><SelectItem value="90D">Last 90 days</SelectItem><SelectItem value="ALL">All time</SelectItem></SelectContent></Select></div>
          <Button type="button" variant="ghost" onClick={clearFilters} disabled={!filterActive}>Clear</Button>
        </div>
      </section>

      {!data?.sales.length ? (
        <section className="rounded-md border border-dashed border-border py-20 text-center"><PackageCheck className="mx-auto h-9 w-9 text-muted-foreground" /><h2 className="mt-3 font-heading text-xl font-bold">No matching sales</h2><p className="mt-1 text-sm text-muted-foreground">Try a wider date range or clear a filter.</p></section>
      ) : (
        <section className="overflow-hidden rounded-md border border-border bg-background">
          {data.sales.map((sale, index) => {
            const isExpanded = expanded.has(sale.id)
            const itemCount = sale.items.reduce((sum, item) => sum + item.quantity, 0)
            const operator = sale.operator?.name || sale.operator?.email
            const customer = sale.paymentLink?.customerName || sale.paymentLink?.customerEmail || sale.receiptEmail
            const saleValue = sale.total + sale.giftVoucherAmount
            return <article key={sale.id} className={cn(index > 0 && "border-t border-border", sale.status === "VOIDED" && "opacity-75")}>
              <button type="button" onClick={() => toggleExpanded(sale.id)} className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-muted/35 lg:grid-cols-[minmax(0,1.5fr)_minmax(150px,.7fr)_minmax(120px,.55fr)_auto] lg:items-center" aria-expanded={isExpanded}>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={channelStyles[sale.channel]}>{salesChannelLabels[sale.channel]}</Badge><Badge variant="outline" className={statusStyles[sale.status]}>{statusLabel(sale.status)}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(sale.createdAt)}</span></div><p className="mt-2 truncate font-semibold text-foreground">{customer || operator || sale.id}</p><p className="mt-0.5 truncate text-sm text-muted-foreground">{sale.items.map((item) => `${item.quantity} × ${item.nameSnapshot}`).join(", ")}</p></div>
                <div className="text-sm"><p className="font-medium text-foreground">{paymentLabel(sale.paymentMethod)}</p><p className="mt-0.5 text-muted-foreground">{itemCount} {itemCount === 1 ? "item" : "items"}{operator ? ` · ${operator}` : ""}</p></div>
                <div className="lg:text-right"><p className="font-heading text-lg font-bold text-foreground">{formatPrice(saleValue)}</p>{sale.giftVoucherAmount > 0 && <p className="text-xs text-muted-foreground">{formatPrice(sale.total)} collected now</p>}</div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {isExpanded && <div className="border-t border-border bg-muted/20 px-4 py-5"><div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)_minmax(260px,.9fr)]">
                <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</p><div className="mt-2 divide-y divide-border border-y border-border">{sale.items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-2.5 text-sm"><div><p className="font-medium">{item.quantity} × {item.nameSnapshot}</p><p className="text-xs text-muted-foreground">{[item.categorySnapshot, item.skuSnapshot].filter(Boolean).join(" · ")}</p>{item.discountAmount > 0 && <p className="text-xs text-emerald-700">Discount {formatPrice(item.discountAmount)}</p>}</div><p>{formatPrice(item.lineTotal)}</p></div>)}</div></div>

                <dl className="grid content-start gap-2 text-sm"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amounts</p><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatPrice(sale.subtotal)}</dd></div>{sale.discountTotal > 0 && <div className="flex justify-between gap-4 text-emerald-700"><dt>Discount{sale.promoCodeSnapshot ? ` · ${sale.promoCodeSnapshot}` : ""}</dt><dd>-{formatPrice(sale.discountTotal)}</dd></div>}{sale.taxTotal > 0 && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Tax</dt><dd>{formatPrice(sale.taxTotal)}</dd></div>}{sale.shippingAmount > 0 && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Shipping</dt><dd>{formatPrice(sale.shippingAmount)}</dd></div>}{sale.giftVoucherAmount > 0 && <div className="flex justify-between gap-4 text-emerald-700"><dt>Gift card{sale.giftVoucherCodeSnapshot ? ` · ${sale.giftVoucherCodeSnapshot}` : ""}</dt><dd>-{formatPrice(sale.giftVoucherAmount)}</dd></div>}<div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold"><dt>Collected</dt><dd>{formatPrice(sale.total)}</dd></div><div className="mt-2 border-t border-border pt-3"><dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment</dt><dd className="mt-1">{paymentLabel(sale.paymentMethod)}</dd><dd className="mt-1 break-all font-mono text-xs text-muted-foreground">{sale.paymentReference || "No reference"}</dd><dd className="mt-1 break-all font-mono text-xs text-muted-foreground">{sale.paymentSessionId || "No session"}</dd></div></dl>

                <div className="space-y-4 text-sm"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</p><p className="mt-2 font-medium">{salesChannelLabels[sale.channel]}</p>{operator && <p className="text-muted-foreground">Operator: {operator}</p>}{sale.receiptEmail && <p className="break-all text-muted-foreground">Receipt: {sale.receiptEmail}</p>}<p className="text-xs text-muted-foreground">Receipt {sale.receiptSentAt ? `sent ${formatDateTime(sale.receiptSentAt)}` : "not sent"}</p></div>
                  {sale.paymentLink && <div className="border-t border-border pt-3"><p className="font-medium">{sale.paymentLink.title}</p><p className="text-muted-foreground">{sale.paymentLink.purpose.replace(/_/g, " ").toLowerCase()}</p>{sale.paymentLink.customerName && <p className="text-muted-foreground">{sale.paymentLink.customerName}</p>}{sale.paymentLink.customerPhone && <p className="text-muted-foreground">{sale.paymentLink.customerPhone}</p>}</div>}
                  {sale.purchasedGiftVoucher && <div className="border-t border-border pt-3"><p className="font-medium">Gift card {sale.purchasedGiftVoucher.code}</p><p className="text-muted-foreground">{sale.purchasedGiftVoucher.type.toLowerCase()} · {sale.purchasedGiftVoucher.status.toLowerCase().replace(/_/g, " ")}{sale.purchasedGiftVoucher.recipientName ? ` · for ${sale.purchasedGiftVoucher.recipientName}` : ""}</p><div className="mt-2 flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><a href={`/gift-cards/v/${encodeURIComponent(sale.purchasedGiftVoucher.token)}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-3.5 w-3.5" />View gift card</a></Button><Button asChild size="sm" variant="outline"><a href={`/api/gift-vouchers/${encodeURIComponent(sale.purchasedGiftVoucher.token)}/download`}>Export PDF</a></Button></div></div>}
                  {sale.fulfillmentMethod === "SHIPPING" && <div className="border-t border-border pt-3"><p className="font-medium">Ship to</p><p className="text-muted-foreground">{[sale.shippingAddress, sale.shippingCity, sale.shippingPostalCode, sale.shippingCountry].filter(Boolean).join(", ")}</p></div>}
                  {sale.status === "VOIDED" && <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3"><p className="font-medium">Voided {sale.voidedAt ? formatDateTime(sale.voidedAt) : ""}</p><p className="text-muted-foreground">By {sale.voidedBy?.name || sale.voidedBy?.email || "staff"}{sale.voidReason ? ` · ${sale.voidReason}` : ""}</p></div>}
                  {sale.notes && <details className="border-t border-border pt-3"><summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">Internal note</summary><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{sale.notes}</p></details>}
                  {sale.channel === "WEBSITE" && sale.status === "PAID" && <Button type="button" variant={sale.fulfilledAt ? "outline" : "default"} size="sm" className="w-full" disabled={savingFulfillmentId === sale.id} onClick={() => void setFulfilled(sale, !sale.fulfilledAt)}>{savingFulfillmentId === sale.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{sale.fulfilledAt ? "Mark not fulfilled" : "Mark fulfilled"}</Button>}
                  {sale.channel === "POS" && <Button asChild variant="outline" size="sm" className="w-full"><Link href="/admin/pos/sales">Open POS operations</Link></Button>}
                </div>
              </div></div>}
            </article>
          })}
        </section>
      )}

      {data?.nextCursor && <div className="flex justify-center"><Button type="button" variant="outline" disabled={loadingMore} onClick={() => void fetchSales({ cursor: data.nextCursor || undefined })}>{loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Load older sales</Button></div>}
    </div>
  )
}
