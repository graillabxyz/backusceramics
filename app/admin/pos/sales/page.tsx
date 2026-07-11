"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, RefreshCw, RotateCcw, ShoppingCart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { formatPrice } from "@/lib/pos-catalog"

interface PosSaleItem {
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

interface PosSaleUser {
  id: string
  name: string | null
  email: string | null
}

interface PosSale {
  id: string
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  currency: string
  status: string
  paymentMethod: string
  receiptEmail: string | null
  notes: string | null
  voidedAt: string | null
  voidReason: string | null
  createdAt: string
  items: PosSaleItem[]
  operator: PosSaleUser | null
  voidedBy: PosSaleUser | null
}

const statusTone: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  PENDING_PAYMENT: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-gray-100 text-gray-800",
  VOIDED: "bg-red-100 text-red-800",
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function itemSummary(items: PosSaleItem[]) {
  const names = items.map((item) => `${item.quantity} x ${item.nameSnapshot}`)
  if (names.length <= 3) return names.join(", ")
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`
}

export default function PosSalesPage() {
  const [sales, setSales] = useState<PosSale[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [voidingSaleId, setVoidingSaleId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState("")
  const [restoreStock, setRestoreStock] = useState(true)
  const [savingVoid, setSavingVoid] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const openSales = useMemo(() => sales.filter((sale) => sale.status !== "VOIDED" && sale.status !== "CANCELLED"), [sales])

  useEffect(() => {
    void fetchSales()
  }, [])

  const fetchSales = async () => {
    setError("")
    setRefreshing(true)
    try {
      const res = await fetch("/api/pos/sales?limit=150")
      const data = await res.json().catch(() => [])
      if (res.status === 423 && data.code === "POS_PIN_LOCKED") {
        window.location.assign(`/admin/pos?returnTo=${encodeURIComponent("/admin/pos/sales?posFullscreen=1")}`)
        return
      }
      if (!res.ok) throw new Error(data.error || "Could not load POS sales")
      setSales(data)
    } catch (salesError) {
      console.error("Could not load POS sales", salesError)
      setError(salesError instanceof Error ? salesError.message : "Could not load POS sales.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const startVoid = (saleId: string) => {
    setVoidingSaleId(saleId)
    setVoidReason("")
    setRestoreStock(true)
    setError("")
    setSuccess("")
  }

  const voidSale = async (saleId: string) => {
    setSavingVoid(true)
    setError("")
    setSuccess("")
    try {
      const res = await fetch(`/api/pos/sales/${saleId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: voidReason,
          restock: restoreStock,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 423 && data.code === "POS_PIN_LOCKED") {
        window.location.assign(`/admin/pos?returnTo=${encodeURIComponent("/admin/pos/sales?posFullscreen=1")}`)
        return
      }
      if (!res.ok) throw new Error(data.error || "Sale could not be voided")

      setSales((current) => current.map((sale) => sale.id === data.id ? data : sale))
      setVoidingSaleId(null)
      setVoidReason("")
      setSuccess("Sale voided. Stock was updated according to your selection.")
    } catch (voidError) {
      console.error("Could not void sale", voidError)
      setError(voidError instanceof Error ? voidError.message : "Sale could not be voided.")
    } finally {
      setSavingVoid(false)
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
          <h1 className="font-heading text-2xl font-bold text-foreground">POS Sales History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {openSales.length} active sales · {sales.length} recent records
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/pos?posFullscreen=1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to POS
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={fetchSales} disabled={refreshing}>
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

      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
        Voiding a sale corrects the POS record and can restore inventory. It does not refund a card, QRIS, transfer, or online payment automatically.
      </div>

      {sales.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <CardTitle className="font-heading text-xl">No sales yet</CardTitle>
            <CardDescription>Recorded POS sales will appear here.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => {
            const canVoid = sale.status !== "VOIDED" && sale.status !== "CANCELLED"
            const voidFormOpen = voidingSaleId === sale.id
            return (
              <Card key={sale.id} className={sale.status === "VOIDED" ? "opacity-75" : ""}>
                <CardContent className="p-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge className={statusTone[sale.status] || statusTone.PAID}>{sale.status}</Badge>
                        <span className="text-sm text-muted-foreground">{formatDateTime(sale.createdAt)}</span>
                        <span className="text-sm text-muted-foreground">{sale.paymentMethod.replace(/_/g, " ")}</span>
                      </div>
                      <p className="font-heading text-xl font-bold text-foreground">{formatPrice(sale.total)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{itemSummary(sale.items)}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Operator: {sale.operator?.name || sale.operator?.email || "Unknown"}</span>
                        {sale.receiptEmail && <span>Receipt: {sale.receiptEmail}</span>}
                        {sale.taxTotal > 0 && <span>Tax: {formatPrice(sale.taxTotal)}</span>}
                        {sale.discountTotal > 0 && <span>Discounts: {formatPrice(sale.discountTotal)}</span>}
                      </div>
                      {sale.status === "VOIDED" && (
                        <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-muted-foreground">
                          <p className="font-medium text-foreground">
                            Voided {sale.voidedAt ? formatDateTime(sale.voidedAt) : ""} by {sale.voidedBy?.name || sale.voidedBy?.email || "staff"}
                          </p>
                          {sale.voidReason && <p className="mt-1">{sale.voidReason}</p>}
                        </div>
                      )}
                    </div>

                    {canVoid && (
                      <Button type="button" variant="outline" onClick={() => startVoid(sale.id)}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Void sale
                      </Button>
                    )}
                  </div>

                  {voidFormOpen && (
                    <div className="mt-4 rounded-md border border-border bg-muted/35 p-4">
                      <div className="mb-3 flex items-start gap-2 text-sm text-muted-foreground">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
                        <p>Use this only for recording mistakes. It keeps the sale history and marks the correction clearly.</p>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                        <div className="space-y-2">
                          <Label htmlFor={`void-reason-${sale.id}`}>Reason</Label>
                          <Textarea
                            id={`void-reason-${sale.id}`}
                            value={voidReason}
                            onChange={(event) => setVoidReason(event.target.value)}
                            rows={2}
                            placeholder="Optional note for the record"
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-background p-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">Restore stock</p>
                              <p className="text-xs text-muted-foreground">Add sold quantities back to inventory.</p>
                            </div>
                            <Switch checked={restoreStock} onCheckedChange={setRestoreStock} />
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => setVoidingSaleId(null)} disabled={savingVoid}>
                              Cancel
                            </Button>
                            <Button type="button" variant="destructive" onClick={() => voidSale(sale.id)} disabled={savingVoid}>
                              {savingVoid && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Confirm void
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
