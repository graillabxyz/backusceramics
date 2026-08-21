"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock3,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
  Webhook,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatPrice } from "@/lib/pos-catalog"
import { cn } from "@/lib/utils"

type SaleStatus = "PAID" | "PENDING_PAYMENT" | "CANCELLED" | "VOIDED"

interface WebsiteSaleItem {
  id: string
  nameSnapshot: string
  skuSnapshot: string | null
  categorySnapshot: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

interface WebsiteSale {
  id: string
  subtotal: number
  discountTotal: number
  promoCodeSnapshot: string | null
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
  createdAt: string
  items: WebsiteSaleItem[]
}

interface SalesResponse {
  sales: WebsiteSale[]
  totals: Partial<Record<SaleStatus, { count: number; total: number }>>
  reconciliation: {
    checked: number
    updated: number
    failed: number
  }
  webhook: {
    endpoint: string
    lastReceived: {
      event: string | null
      status: string | null
      paymentSessionId: string | null
      paymentReference: string | null
      receivedAt: string
    } | null
  }
}

const filters: Array<{ value: "ALL" | SaleStatus; label: string }> = [
  { value: "ALL", label: "All sales" },
  { value: "PAID", label: "Paid" },
  { value: "PENDING_PAYMENT", label: "Needs confirmation" },
  { value: "CANCELLED", label: "Cancelled" },
]

const statusStyles: Record<SaleStatus, string> = {
  PAID: "border-emerald-300 bg-emerald-50 text-emerald-800",
  PENDING_PAYMENT: "border-amber-300 bg-amber-50 text-amber-900",
  CANCELLED: "border-border bg-muted text-muted-foreground",
  VOIDED: "border-red-300 bg-red-50 text-red-800",
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function statusLabel(status: SaleStatus) {
  if (status === "PENDING_PAYMENT") return "Needs confirmation"
  return status.charAt(0) + status.slice(1).toLowerCase()
}

function fulfillmentLabel(method: string) {
  if (method === "SHIPPING") return "Protected shipping"
  if (method === "CUSTOM_PAYMENT") return "Payment link"
  return "Shop pickup"
}

function totalFor(
  totals: SalesResponse["totals"],
  status: SaleStatus,
  field: "count" | "total"
) {
  return totals[status]?.[field] || 0
}

export default function WebsiteSalesPage() {
  const [data, setData] = useState<SalesResponse | null>(null)
  const [filter, setFilter] = useState<"ALL" | SaleStatus>("ALL")
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [savingFulfillmentId, setSavingFulfillmentId] = useState("")

  const fetchSales = useCallback(async (manual = false) => {
    setError("")
    manual ? setRefreshing(true) : setLoading(true)
    try {
      const res = await fetch("/api/admin/sales?limit=250", { cache: "no-store" })
      const response = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(response.error || "Could not load website sales")
      setData(response as SalesResponse)
    } catch (salesError) {
      console.error("Could not load website sales", salesError)
      setError(salesError instanceof Error ? salesError.message : "Could not load website sales.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchSales()
  }, [fetchSales])

  const visibleSales = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return (data?.sales || []).filter((sale) => {
      if (filter !== "ALL" && sale.status !== filter) return false
      if (!normalizedQuery) return true
      return [
        sale.id,
        sale.receiptEmail,
        sale.paymentReference,
        sale.paymentSessionId,
        sale.shippingCity,
        ...sale.items.flatMap((item) => [item.nameSnapshot, item.skuSnapshot]),
      ].some((value) => value?.toLowerCase().includes(normalizedQuery))
    })
  }, [data?.sales, filter, query])

  const toggleExpanded = (saleId: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      next.has(saleId) ? next.delete(saleId) : next.add(saleId)
      return next
    })
  }

  const setFulfilled = async (sale: WebsiteSale, fulfilled: boolean) => {
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
      setData((current) => current ? {
        ...current,
        sales: current.sales.map((item) => item.id === sale.id ? { ...item, fulfilledAt: payload.sale.fulfilledAt } : item),
      } : current)
    } catch (fulfillmentError) {
      console.error("Website sale fulfillment update failed", fulfillmentError)
      setError(fulfillmentError instanceof Error ? fulfillmentError.message : "Could not update fulfillment.")
    } finally {
      setSavingFulfillmentId("")
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  const totals = data?.totals || {}
  const orderCount = Object.values(totals).reduce((sum, value) => sum + (value?.count || 0), 0)
  const paidRevenue = totalFor(totals, "PAID", "total")
  const pendingCount = totalFor(totals, "PENDING_PAYMENT", "count")
  const shippedCount = data?.sales.filter((sale) => sale.fulfillmentMethod === "SHIPPING").length || 0
  const lastWebhookAt = data?.webhook.lastReceived?.receivedAt

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Online commerce</p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-foreground">Website Sales</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Purchases made through the public shop. Cashier transactions remain in POS Sales History.
          </p>
        </div>
        <Button type="button" onClick={() => fetchSales(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Check Xendit and refresh
        </Button>
      </header>

      {error && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Website orders", value: orderCount.toLocaleString(), icon: ShoppingBag },
          { label: "Paid revenue", value: formatPrice(paidRevenue), icon: CheckCircle2 },
          { label: "Needs confirmation", value: pendingCount.toLocaleString(), icon: Clock3 },
          { label: "Shipping orders", value: shippedCount.toLocaleString(), icon: Truck },
        ].map((metric) => (
          <div key={metric.label} className="bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 font-heading text-2xl font-bold text-foreground">{metric.value}</p>
          </div>
        ))}
      </section>

      <section className={cn(
        "flex flex-col gap-3 rounded-md border px-4 py-3 text-sm lg:flex-row lg:items-center lg:justify-between",
        lastWebhookAt
          ? "border-emerald-300 bg-emerald-50 text-emerald-950"
          : "border-amber-300 bg-amber-50 text-amber-950"
      )}>
        <div className="flex min-w-0 items-start gap-3">
          <Webhook className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {lastWebhookAt ? "Verified Xendit callback received" : "No verified callback recorded yet"}
            </p>
            <p className="mt-0.5 text-xs opacity-80">
              {lastWebhookAt
                ? `${data?.webhook.lastReceived?.event || "Payment event"} · ${formatDateTime(lastWebhookAt)}`
                : "This audit record begins with this release. Direct Xendit status reconciliation remains active."}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-xs">
          Checked {data?.reconciliation.checked || 0} pending · repaired {data?.reconciliation.updated || 0}
          {(data?.reconciliation.failed || 0) > 0 ? ` · ${data?.reconciliation.failed} need review` : ""}
        </p>
      </section>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <Button
              key={item.value}
              type="button"
              variant={filter === item.value ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setFilter(item.value)}
            >
              {item.label}
              {item.value !== "ALL" && (
                <span className="ml-2 opacity-70">{totalFor(totals, item.value, "count")}</span>
              )}
            </Button>
          ))}
        </div>
        <div className="relative w-full xl:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customer, item, or reference"
            className="pl-9"
          />
        </div>
      </div>

      {visibleSales.length === 0 ? (
        <section className="rounded-md border border-dashed border-border py-20 text-center">
          <PackageCheck className="mx-auto h-9 w-9 text-muted-foreground" />
          <h2 className="mt-3 font-heading text-xl font-bold">No matching website sales</h2>
          <p className="mt-1 text-sm text-muted-foreground">New public shop purchases will appear here.</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-md border border-border bg-background">
          {visibleSales.map((sale, index) => {
            const isExpanded = expanded.has(sale.id)
            const itemCount = sale.items.reduce((sum, item) => sum + item.quantity, 0)
            return (
              <article key={sale.id} className={cn(index > 0 && "border-t border-border")}>
                <button
                  type="button"
                  onClick={() => toggleExpanded(sale.id)}
                  className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-muted/35 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] md:items-center"
                  aria-expanded={isExpanded}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={statusStyles[sale.status]}>{statusLabel(sale.status)}</Badge>
                      {sale.status === "PAID" && sale.fulfillmentMethod !== "CUSTOM_PAYMENT" && (
                        <Badge variant={sale.fulfilledAt ? "secondary" : "outline"}>{sale.fulfilledAt ? "Fulfilled" : "Needs fulfillment"}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDateTime(sale.createdAt)}</span>
                    </div>
                    <p className="mt-2 truncate font-semibold text-foreground">
                      {sale.receiptEmail || "No receipt email"}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {sale.items.map((item) => `${item.quantity} × ${item.nameSnapshot}`).join(", ")}
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-foreground">
                      {fulfillmentLabel(sale.fulfillmentMethod)}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">{itemCount} {itemCount === 1 ? "item" : "items"}</p>
                  </div>
                  <p className="font-heading text-lg font-bold text-foreground">{formatPrice(sale.total)}</p>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 px-4 py-4">
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)]">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</p>
                        <div className="mt-2 divide-y divide-border border-y border-border">
                          {sale.items.map((item) => (
                            <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-2.5 text-sm">
                              <div>
                                <p className="font-medium">{item.quantity} × {item.nameSnapshot}</p>
                                <p className="text-xs text-muted-foreground">
                                  {[item.categorySnapshot, item.skuSnapshot].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                              <p>{formatPrice(item.lineTotal)}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <dl className="grid content-start gap-2 text-sm">
                        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatPrice(sale.subtotal)}</dd></div>
                        {sale.discountTotal > 0 && (
                          <div className="flex justify-between gap-4 text-emerald-700">
                            <dt>Promo{sale.promoCodeSnapshot ? ` · ${sale.promoCodeSnapshot}` : ""}</dt>
                            <dd>-{formatPrice(sale.discountTotal)}</dd>
                          </div>
                        )}
                        {sale.shippingAmount > 0 && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Shipping</dt><dd>{formatPrice(sale.shippingAmount)}</dd></div>}
                        <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold"><dt>Total</dt><dd>{formatPrice(sale.total)}</dd></div>
                        <div className="mt-2 border-t border-border pt-3">
                          <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment reference</dt>
                          <dd className="mt-1 break-all font-mono text-xs">{sale.paymentReference || "Not created"}</dd>
                          <dd className="mt-1 break-all font-mono text-xs text-muted-foreground">{sale.paymentSessionId || "No session id"}</dd>
                        </div>
                        {sale.fulfillmentMethod === "SHIPPING" && (
                          <div className="mt-2 border-t border-border pt-3">
                            <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ship to</dt>
                            <dd className="mt-1 leading-relaxed">
                              {[sale.shippingAddress, sale.shippingCity, sale.shippingPostalCode, sale.shippingCountry].filter(Boolean).join(", ")}
                            </dd>
                          </div>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          Receipt {sale.receiptSentAt ? `sent ${formatDateTime(sale.receiptSentAt)}` : "not sent yet"}
                        </p>
                        {sale.status === "PAID" && sale.fulfillmentMethod !== "CUSTOM_PAYMENT" && (
                          <Button
                            type="button"
                            variant={sale.fulfilledAt ? "outline" : "default"}
                            size="sm"
                            className="mt-3 w-full"
                            disabled={savingFulfillmentId === sale.id}
                            onClick={() => void setFulfilled(sale, !sale.fulfilledAt)}
                          >
                            {savingFulfillmentId === sale.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {sale.fulfilledAt ? "Mark as not fulfilled" : "Mark fulfilled"}
                          </Button>
                        )}
                      </dl>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
