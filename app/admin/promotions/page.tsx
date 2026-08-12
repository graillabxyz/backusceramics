"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarClock, CheckCircle2, Loader2, PauseCircle, Plus, RefreshCw, TicketPercent } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatPrice } from "@/lib/pos-catalog"

interface PromoCodeRecord {
  id: string
  code: string
  description: string | null
  discountType: "PERCENT" | "FIXED"
  discountValue: number
  maxDiscount: number | null
  minSubtotal: number
  scope: "ALL" | "SHOP" | "CLASSES"
  active: boolean
  startsAt: string | null
  expiresAt: string | null
  maxRedemptions: number | null
  maxRedemptionsPerUser: number
  createdAt: string
  usage: {
    redeemed: number
    reserved: number
    discountGranted: number
  }
}

const initialForm = {
  code: "",
  description: "",
  discountType: "PERCENT" as "PERCENT" | "FIXED",
  discountValue: "",
  maxDiscount: "",
  minSubtotal: "",
  scope: "ALL" as "ALL" | "SHOP" | "CLASSES",
  startsAt: "",
  expiresAt: "",
  maxRedemptions: "",
  maxRedemptionsPerUser: "1",
}

function formatDate(value: string | null) {
  if (!value) return "No limit"
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export default function PromotionsPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCodeRecord[]>([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadPromoCodes = useCallback(async () => {
    setError("")
    try {
      const response = await fetch("/api/admin/promo-codes", { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Could not load promo codes.")
      setPromoCodes(payload.promoCodes || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load promo codes.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPromoCodes()
  }, [loadPromoCodes])

  const createPromo = async () => {
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          discountValue: form.discountValue,
          maxDiscount: form.maxDiscount,
          minSubtotal: form.minSubtotal,
          maxRedemptions: form.maxRedemptions,
          maxRedemptionsPerUser: form.maxRedemptionsPerUser,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Could not create promo code.")
      setForm(initialForm)
      setNotice(`${payload.promoCode.code} is ready to use.`)
      await loadPromoCodes()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create promo code.")
    } finally {
      setSaving(false)
    }
  }

  const setActive = async (promo: PromoCodeRecord, active: boolean) => {
    setUpdatingId(promo.id)
    setError("")
    try {
      const response = await fetch("/api/admin/promo-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: promo.id, active, activeOnly: true }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Could not update promo code.")
      setPromoCodes((current) => current.map((item) => item.id === promo.id ? { ...item, active } : item))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update promo code.")
    } finally {
      setUpdatingId("")
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Commerce</p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-foreground">Promo Codes</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Create controlled discounts for classes, the online shop, or both. Discounts are verified again during secure checkout.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadPromoCodes()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </header>

      {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
      {notice && <p className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold">Current promotions</h2>
            <span className="text-sm text-muted-foreground">{promoCodes.length} codes</span>
          </div>
          {loading ? (
            <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : promoCodes.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-6 py-16 text-center">
              <TicketPercent className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-3 font-semibold">No promo codes yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create the first code using the form.</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {promoCodes.map((promo) => {
                const expired = Boolean(promo.expiresAt && new Date(promo.expiresAt) <= new Date())
                return (
                  <Card key={promo.id} className="overflow-hidden border-border">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-mono text-lg font-bold tracking-wide">{promo.code}</h3>
                            <Badge variant={promo.active && !expired ? "default" : "secondary"}>
                              {expired ? "Expired" : promo.active ? "Active" : "Paused"}
                            </Badge>
                            <Badge variant="outline">{promo.scope === "ALL" ? "Classes + shop" : promo.scope === "SHOP" ? "Shop" : "Classes"}</Badge>
                          </div>
                          {promo.description && <p className="mt-2 text-sm text-muted-foreground">{promo.description}</p>}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingId === promo.id || expired}
                          onClick={() => void setActive(promo, !promo.active)}
                        >
                          {updatingId === promo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : promo.active ? <PauseCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          <span className="ml-2">{promo.active ? "Pause" : "Activate"}</span>
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><p className="text-xs text-muted-foreground">Discount</p><p className="font-semibold">{promo.discountType === "PERCENT" ? `${promo.discountValue}%` : formatPrice(promo.discountValue)}</p></div>
                        <div><p className="text-xs text-muted-foreground">Minimum</p><p className="font-semibold">{promo.minSubtotal ? formatPrice(promo.minSubtotal) : "None"}</p></div>
                        <div><p className="text-xs text-muted-foreground">Redeemed</p><p className="font-semibold">{promo.usage.redeemed}{promo.maxRedemptions ? ` / ${promo.maxRedemptions}` : ""}</p></div>
                        <div><p className="text-xs text-muted-foreground">Discount granted</p><p className="font-semibold">{formatPrice(promo.usage.discountGranted)}</p></div>
                      </div>

                      <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />Ends {formatDate(promo.expiresAt)}</span>
                        {promo.usage.reserved > 0 && <span>{promo.usage.reserved} in checkout</span>}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="space-y-4 rounded-md border border-border bg-background p-5">
            <div>
              <h2 className="font-heading text-xl font-bold">Create promo</h2>
              <p className="mt-1 text-sm text-muted-foreground">Codes use uppercase automatically.</p>
            </div>
            <div className="space-y-2"><Label htmlFor="promo-code">Code</Label><Input id="promo-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="WELCOME10" maxLength={32} /></div>
            <div className="space-y-2"><Label htmlFor="promo-description">Internal description</Label><Textarea id="promo-description" rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="New customer offer" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Type</Label><select value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value as "PERCENT" | "FIXED" })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="PERCENT">Percent</option><option value="FIXED">Fixed IDR</option></select></div>
              <div className="space-y-2"><Label htmlFor="promo-value">{form.discountType === "PERCENT" ? "Percent" : "Amount (IDR)"}</Label><Input id="promo-value" type="number" min="1" max={form.discountType === "PERCENT" ? 100 : undefined} value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} /></div>
            </div>
            {form.discountType === "PERCENT" && <div className="space-y-2"><Label htmlFor="promo-cap">Maximum discount (IDR, optional)</Label><Input id="promo-cap" type="number" min="1" value={form.maxDiscount} onChange={(event) => setForm({ ...form, maxDiscount: event.target.value })} /></div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Applies to</Label><select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as typeof form.scope })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="ALL">Classes + shop</option><option value="CLASSES">Classes only</option><option value="SHOP">Shop only</option></select></div>
              <div className="space-y-2"><Label htmlFor="promo-minimum">Minimum subtotal</Label><Input id="promo-minimum" type="number" min="0" value={form.minSubtotal} onChange={(event) => setForm({ ...form, minSubtotal: event.target.value })} placeholder="0" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="promo-total-limit">Total use limit</Label><Input id="promo-total-limit" type="number" min="1" value={form.maxRedemptions} onChange={(event) => setForm({ ...form, maxRedemptions: event.target.value })} placeholder="Unlimited" /></div>
              <div className="space-y-2"><Label htmlFor="promo-user-limit">Per customer</Label><Input id="promo-user-limit" type="number" min="1" value={form.maxRedemptionsPerUser} onChange={(event) => setForm({ ...form, maxRedemptionsPerUser: event.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="promo-start">Starts</Label><Input id="promo-start" type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="promo-end">Ends</Label><Input id="promo-end" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></div>
            </div>
            <Button className="w-full" onClick={() => void createPromo()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create promo code
            </Button>
          </div>
        </aside>
      </section>
    </div>
  )
}
