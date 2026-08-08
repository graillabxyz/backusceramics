"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BellRing, CalendarCheck, Clock3, ExternalLink, ShoppingBag, Volume2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { playNotificationChime } from "@/lib/client-notification-sound"
import { formatPrice } from "@/lib/pos-catalog"

type BriefingSale = {
  id: string
  total: number
  createdAt: string
  receiptEmail: string | null
  items: Array<{ id: string; nameSnapshot: string; quantity: number }>
}

type BriefingData = {
  dateKey: string
  generatedAt: string
  preference: {
    morningBriefingEnabled: boolean
    morningBriefingSoundEnabled: boolean
  }
  bookings: Array<{
    id: string
    workshopId: string
    preferredDate: string | null
    participants: number
    contactName: string
    contactPhone: string | null
  }>
  overnightSales: BriefingSale[]
  openOrders: BriefingSale[]
}

function saleSummary(sale: BriefingSale) {
  return sale.items.map((item) => `${item.quantity} x ${item.nameSnapshot}`).join(", ")
}

export function PosMorningBriefing({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const loadBriefing = useCallback(async (force = false) => {
    if (!enabled) return
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/pos/briefing", { cache: "no-store" })
      const payload = await response.json().catch(() => ({})) as BriefingData & { error?: string }
      if (!response.ok) throw new Error(payload.error || "Could not load the POS briefing")
      setData(payload)

      const storageKey = `backus-pos-briefing:${payload.dateKey}`
      const alreadyShown = window.localStorage.getItem(storageKey) === "shown"
      if (force || (payload.preference.morningBriefingEnabled && !alreadyShown)) {
        setOpen(true)
        window.localStorage.setItem(storageKey, "shown")
        const hasAction = payload.bookings.length > 0 || payload.overnightSales.length > 0 || payload.openOrders.length > 0
        if (hasAction && payload.preference.morningBriefingSoundEnabled) {
          await playNotificationChime()
        }
      }
    } catch (loadError) {
      console.error("POS briefing load failed", loadError)
      if (force) {
        setError(loadError instanceof Error ? loadError.message : "Could not load the POS briefing.")
        setOpen(true)
      }
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void loadBriefing(false)
  }, [loadBriefing])

  useEffect(() => {
    const openBriefing = () => void loadBriefing(true)
    window.addEventListener("backus-open-pos-briefing", openBriefing)
    return () => window.removeEventListener("backus-open-pos-briefing", openBriefing)
  }, [loadBriefing])

  const uniqueOpenOrders = data?.openOrders.filter(
    (sale) => !data.overnightSales.some((overnight) => overnight.id === sale.id)
  ) || []
  const actionCount = (data?.bookings.length || 0) + (data?.overnightSales.length || 0) + uniqueOpenOrders.length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BellRing className="h-5 w-5" />
          </div>
          <DialogTitle className="font-heading text-2xl">Opening briefing</DialogTitle>
          <DialogDescription>
            {data ? `${actionCount} ${actionCount === 1 ? "item" : "items"} to review for ${data.dateKey} in Bali.` : "Loading today's work."}
          </DialogDescription>
        </DialogHeader>

        {loading && !data && <p className="py-8 text-center text-sm text-muted-foreground">Preparing the register briefing...</p>}
        {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

        {data && (
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 font-semibold"><CalendarCheck className="h-4 w-4" /> Today&apos;s classes</h3>
                <Badge variant="outline">{data.bookings.length}</Badge>
              </div>
              {data.bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No confirmed classes are booked for today.</p>
              ) : data.bookings.map((booking) => (
                <div key={booking.id} className="grid gap-1 border-b pb-3 text-sm last:border-b-0 sm:grid-cols-[1fr_auto]">
                  <div><span className="font-medium">{booking.contactName}</span> · {booking.workshopId}</div>
                  <div className="text-muted-foreground">{booking.participants} {booking.participants === 1 ? "seat" : "seats"}</div>
                  <div className="text-muted-foreground sm:col-span-2">{booking.preferredDate || "Time to confirm"}</div>
                </div>
              ))}
              <Button variant="outline" size="sm" asChild><Link href="/admin/bookings">Open class calendar <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link></Button>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 font-semibold"><ShoppingBag className="h-4 w-4" /> Overnight website sales</h3>
                <Badge variant="outline">{data.overnightSales.length}</Badge>
              </div>
              {data.overnightSales.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing sold online overnight.</p>
              ) : data.overnightSales.map((sale) => (
                <div key={sale.id} className="grid gap-1 border-b pb-3 text-sm last:border-b-0 sm:grid-cols-[1fr_auto]">
                  <span className="font-medium">{saleSummary(sale)}</span>
                  <span className="font-semibold">{formatPrice(sale.total)}</span>
                  <span className="text-muted-foreground">{sale.receiptEmail || "No receipt email"}</span>
                </div>
              ))}
            </section>

            {uniqueOpenOrders.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 font-semibold"><Clock3 className="h-4 w-4" /> Recent online orders to review</h3>
                  <Badge variant="outline">{uniqueOpenOrders.length}</Badge>
                </div>
                {uniqueOpenOrders.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between gap-4 border-b pb-3 text-sm last:border-b-0">
                    <span className="min-w-0 truncate">{saleSummary(sale)}</span>
                    <span className="shrink-0 font-semibold">{formatPrice(sale.total)}</span>
                  </div>
                ))}
              </section>
            )}

            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => void playNotificationChime()}><Volume2 className="mr-2 h-4 w-4" /> Test sound</Button>
              <div className="flex gap-2">
                <Button variant="outline" asChild><Link href="/admin/sales">Website sales</Link></Button>
                <Button onClick={() => setOpen(false)}>Start selling</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
