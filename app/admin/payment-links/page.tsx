"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { Check, CircleDollarSign, Clock3, Copy, ExternalLink, Eye, Link2, Loader2, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { paymentLinkPurposeLabels, type PaymentLinkPurpose } from "@/lib/custom-payment-links"
import { formatPrice } from "@/lib/pos-catalog"
import { cn } from "@/lib/utils"

type DisplayStatus = "ACTIVE" | "PAID" | "EXPIRED" | "CANCELLED"

interface PaymentLinkRecord {
  id: string
  token: string
  title: string
  description: string | null
  amount: number
  purpose: PaymentLinkPurpose
  customerName: string | null
  customerEmail: string | null
  expiresAt: string
  openedAt: string | null
  createdAt: string
  displayStatus: DisplayStatus
  createdBy: { name: string | null; email: string }
  sales: Array<{ id: string; status: string; createdAt: string }>
}

interface PaymentLinkResponse {
  links: PaymentLinkRecord[]
  summary: { active: number; paid: number; paidTotal: number; opened: number }
}

const statusStyles: Record<DisplayStatus, string> = {
  ACTIVE: "border-blue-200 bg-blue-50 text-blue-800",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-800",
  EXPIRED: "border-border bg-muted text-muted-foreground",
  CANCELLED: "border-red-200 bg-red-50 text-red-800",
}

const emptyForm = {
  title: "",
  description: "",
  amount: "",
  purpose: "CUSTOM_ORDER" as PaymentLinkPurpose,
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  expiresInDays: "7",
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export default function PaymentLinksPage() {
  const [data, setData] = useState<PaymentLinkResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"ALL" | DisplayStatus>("ALL")
  const [form, setForm] = useState(emptyForm)

  const loadLinks = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/payment-links", { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Could not load payment links.")
      setData(payload)
    } catch (error) {
      console.error("Could not load payment links", error)
      toast.error(error instanceof Error ? error.message : "Could not load payment links.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadLinks() }, [loadLinks])

  const visibleLinks = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (data?.links || []).filter((link) => {
      if (filter !== "ALL" && link.displayStatus !== filter) return false
      if (!needle) return true
      return [link.title, link.customerName, link.customerEmail, link.purpose]
        .some((value) => value?.toLowerCase().includes(needle))
    })
  }, [data?.links, filter, query])

  async function copyLink(token: string) {
    const url = `${window.location.origin}/pay/${token}`
    await navigator.clipboard.writeText(url)
    toast.success("Payment link copied")
  }

  async function createLink(event: FormEvent) {
    event.preventDefault()
    setCreating(true)
    try {
      const response = await fetch("/api/admin/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount), expiresInDays: Number(form.expiresInDays) }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Could not create payment link.")
      await navigator.clipboard.writeText(payload.publicUrl)
      toast.success("Payment link created and copied")
      setForm(emptyForm)
      setDialogOpen(false)
      await loadLinks()
    } catch (error) {
      console.error("Could not create payment link", error)
      toast.error(error instanceof Error ? error.message : "Could not create payment link.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Payments</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">Payment links</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Create a fixed, secure Xendit link for shipping, custom work, deposits, or any one-off charge. No temporary product required.</p>
        </div>
        <Button className="min-h-11 gap-2 sm:min-w-48" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> New payment link</Button>
      </header>

      <section className="grid overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active links", value: data?.summary.active || 0, icon: Link2 },
          { label: "Opened", value: data?.summary.opened || 0, icon: Eye },
          { label: "Paid", value: data?.summary.paid || 0, icon: Check },
          { label: "Value collected", value: formatPrice(data?.summary.paidTotal || 0), icon: CircleDollarSign },
        ].map((item) => (
          <div key={item.label} className="flex min-h-28 items-start justify-between bg-background p-5">
            <div><p className="text-xs font-medium text-muted-foreground">{item.label}</p><p className="mt-2 text-2xl font-semibold">{item.value}</p></div>
            <item.icon className="h-4 w-4 text-muted-foreground" />
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-md border border-border bg-background">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
            {(["ALL", "ACTIVE", "PAID", "EXPIRED"] as const).map((value) => (
              <Button key={value} size="sm" variant={filter === value ? "default" : "ghost"} onClick={() => setFilter(value)} className="shrink-0">
                {value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or customer" className="pl-9" />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : visibleLinks.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <Link2 className="h-8 w-8 text-muted-foreground" />
            <p className="mt-4 font-semibold">No payment links here</p>
            <p className="mt-1 text-sm text-muted-foreground">Create one when a customer needs to pay for a custom amount.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visibleLinks.map((link) => (
              <article key={link.id} className="grid gap-4 p-4 transition hover:bg-muted/20 sm:p-5 lg:grid-cols-[minmax(240px,1.3fr)_minmax(180px,.8fr)_150px_190px] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{link.title}</h2>
                    <Badge variant="outline" className={cn("font-medium", statusStyles[link.displayStatus])}>{link.displayStatus === "ACTIVE" ? "Ready to pay" : link.displayStatus.toLowerCase()}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{link.customerName || link.customerEmail || "Open customer link"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{paymentLinkPurposeLabels[link.purpose]} · Created by {link.createdBy.name || link.createdBy.email}</p>
                </div>
                <div><p className="text-lg font-semibold">{formatPrice(link.amount)}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Expires {formatDate(link.expiresAt)}</p></div>
                <div className="text-sm"><p className="font-medium">{link.openedAt ? "Opened" : "Not opened"}</p><p className="mt-1 text-xs text-muted-foreground">{link.openedAt ? formatDate(link.openedAt) : "Waiting for customer"}</p></div>
                <div className="flex gap-2 lg:justify-end">
                  <Button variant="outline" size="sm" className="flex-1 gap-2 lg:flex-none" onClick={() => void copyLink(link.token)}><Copy className="h-4 w-4" /> Copy</Button>
                  <Button variant="ghost" size="icon" asChild><a href={`/pay/${link.token}`} target="_blank" rel="noreferrer" aria-label={`Open ${link.title} payment page`}><ExternalLink className="h-4 w-4" /></a></Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={createLink}>
            <DialogHeader>
              <DialogTitle>Create payment link</DialogTitle>
              <DialogDescription>The customer cannot change the description or amount. A Xendit session is created when you save.</DialogDescription>
            </DialogHeader>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="link-title">Payment title</Label><Input id="link-title" required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Custom lamp order" /></div>
              <div className="space-y-2"><Label>Payment type</Label><Select value={form.purpose} onValueChange={(purpose: PaymentLinkPurpose) => setForm({ ...form, purpose })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(paymentLinkPurposeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="link-amount">Amount (IDR)</Label><Input id="link-amount" required type="number" inputMode="numeric" min={10000} max={1000000000} step={1000} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="750000" /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="link-description">Customer note</Label><Textarea id="link-description" maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What this payment covers, delivery details, or an order reference." /></div>
              <div className="space-y-2"><Label htmlFor="customer-name">Customer name</Label><Input id="customer-name" value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} placeholder="Optional" /></div>
              <div className="space-y-2"><Label htmlFor="customer-email">Receipt email</Label><Input id="customer-email" type="email" value={form.customerEmail} onChange={(event) => setForm({ ...form, customerEmail: event.target.value })} placeholder="Optional" /></div>
              <div className="space-y-2"><Label htmlFor="customer-phone">Customer phone</Label><Input id="customer-phone" value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} placeholder="Optional" /></div>
              <div className="space-y-2"><Label>Link expires</Label><Select value={form.expiresInDays} onValueChange={(expiresInDays) => setForm({ ...form, expiresInDays })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 3, 7, 14, 30].map((days) => <SelectItem key={days} value={String(days)}>{days} day{days === 1 ? "" : "s"}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <DialogFooter className="mt-7">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Create and copy link</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
