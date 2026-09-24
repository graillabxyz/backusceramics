"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarClock, CheckCircle2, Loader2, PauseCircle, Pencil, Plus, RefreshCw, TicketPercent, Trash2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

function formatDateTimeInput(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function formFromPromo(promo: PromoCodeRecord) {
  return {
    code: promo.code,
    description: promo.description || "",
    discountType: promo.discountType,
    discountValue: String(promo.discountValue),
    maxDiscount: promo.maxDiscount ? String(promo.maxDiscount) : "",
    minSubtotal: promo.minSubtotal ? String(promo.minSubtotal) : "",
    scope: promo.scope,
    startsAt: formatDateTimeInput(promo.startsAt),
    expiresAt: formatDateTimeInput(promo.expiresAt),
    maxRedemptions: promo.maxRedemptions ? String(promo.maxRedemptions) : "",
    maxRedemptionsPerUser: String(promo.maxRedemptionsPerUser),
  }
}

export default function PromotionsPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCodeRecord[]>([])
  const [form, setForm] = useState(initialForm)
  const [editingPromo, setEditingPromo] = useState<PromoCodeRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState("")
  const [deletingId, setDeletingId] = useState("")
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

  const resetForm = () => {
    setForm(initialForm)
    setEditingPromo(null)
  }

  const editPromo = (promo: PromoCodeRecord) => {
    setForm(formFromPromo(promo))
    setEditingPromo(promo)
    setError("")
    setNotice("")
  }

  const savePromo = async () => {
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/promo-codes", {
        method: editingPromo ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingPromo ? { id: editingPromo.id } : {}),
          ...form,
          active: editingPromo?.active ?? true,
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
      if (!response.ok) throw new Error(payload.error || `Could not ${editingPromo ? "update" : "create"} promo code.`)
      const previousCode = editingPromo?.code
      resetForm()
      setNotice(previousCode && previousCode !== payload.promoCode.code
        ? `${previousCode} was renamed to ${payload.promoCode.code}. Customers must now use the new code.`
        : `${payload.promoCode.code} is ready to use.`)
      await loadPromoCodes()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Could not ${editingPromo ? "update" : "create"} promo code.`)
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

  const deletePromo = async (promo: PromoCodeRecord) => {
    if (!window.confirm(`Delete promo code ${promo.code}? This cannot be undone.`)) return
    setDeletingId(promo.id)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/promo-codes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: promo.id }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Could not delete promo code.")
      if (editingPromo?.id === promo.id) resetForm()
      setPromoCodes((current) => current.filter((item) => item.id !== promo.id))
      setNotice(`${promo.code} was deleted.`)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete promo code.")
    } finally {
      setDeletingId("")
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
                        <div className="flex shrink-0 flex-wrap justify-end gap-2">
                          <Button variant="outline" size="sm" disabled={saving} onClick={() => editPromo(promo)}>
                            <Pencil className="mr-2 h-4 w-4" />Edit
                          </Button>
                          <Button variant="outline" size="sm" disabled={deletingId === promo.id} onClick={() => void deletePromo(promo)}>
                            {deletingId === promo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            <span className="sr-only">Delete {promo.code}</span>
                          </Button>
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
              <h2 className="font-heading text-xl font-bold">{editingPromo ? "Edit promo code" : "Create promo"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">The promo code is the actual name customers enter at checkout.</p>
            </div>
            <div className="space-y-2"><Label htmlFor="promo-code">Promo code</Label><Input id="promo-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="STUDIO20" maxLength={32} /><p className="text-xs text-muted-foreground">Use 3–32 letters, numbers, dashes, or underscores. {editingPromo ? "Changing this immediately replaces the old checkout code." : "Letters are automatically capitalized."}</p></div>
            <div className="space-y-2"><Label htmlFor="promo-description">Internal note (optional)</Label><Input id="promo-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="September studio sale" maxLength={120} /></div>
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
            <Button className="w-full" onClick={() => void savePromo()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {editingPromo ? "Save changes" : "Create promo code"}
            </Button>
            {editingPromo && <Button className="w-full" variant="outline" onClick={resetForm} disabled={saving}><X className="mr-2 h-4 w-4" />Cancel editing</Button>}
          </div>
        </aside>
      </section>
    </div>
  )
}
