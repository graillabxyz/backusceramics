"use client"

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Banknote, Camera, CheckCircle2, FileText, Loader2, Plus, ReceiptText, RefreshCw, RotateCcw, Trash2, UsersRound, WalletCards, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { prepareImageForUpload } from "@/lib/client-image-upload"
import { formatPrice } from "@/lib/pos-catalog"

const BALI_OFFSET = 8 * 60 * 60 * 1000
const ENTRY_TYPES = { BILL: "Bill received", PAYMENT: "Payment to supplier" } as const

interface SupplierAccount {
  id: string
  name: string
  notes: string | null
  active: boolean
  billsTotal: number
  paymentsTotal: number
  billCount: number
  paymentCount: number
  balance: number
}

interface LedgerEntry {
  id: string
  entryType: "BILL" | "PAYMENT"
  amount: number
  businessDate: string
  description: string | null
  imageUrls: string
  paymentMethod: string | null
  reference: string | null
  createdAt: string
  voidedAt: string | null
  voidReason: string | null
  supplier: { id: string; name: string }
  createdBy: { id: string; name: string | null; email: string } | null
  voidedBy: { id: string; name: string | null; email: string } | null
}

interface SupplierResponse {
  suppliers: SupplierAccount[]
  recentEntries: LedgerEntry[]
  summary: { supplierCount: number; billsTotal: number; paymentsTotal: number; outstanding: number }
}

interface EntryForm {
  entryType: "BILL" | "PAYMENT"
  supplierId: string
  amount: string
  businessDate: string
  description: string
  reference: string
  paymentMethod: string
  imageUrls: string[]
}

function todayBali() {
  return new Date(Date.now() + BALI_OFFSET).toISOString().slice(0, 10)
}

function parseImages(value: string) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

function readableDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
}

function defaultEntryForm(type: "BILL" | "PAYMENT" = "BILL", supplierId = ""): EntryForm {
  return { entryType: type, supplierId, amount: "", businessDate: todayBali(), description: "", reference: "", paymentMethod: "TRANSFER", imageUrls: [] }
}

export default function SupplierAccountsPage() {
  const [data, setData] = useState<SupplierResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageUploadNotice, setImageUploadNotice] = useState("")
  const [imageUploadError, setImageUploadError] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [entryOpen, setEntryOpen] = useState(false)
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [voidEntry, setVoidEntry] = useState<LedgerEntry | null>(null)
  const [voidReason, setVoidReason] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [supplierNotes, setSupplierNotes] = useState("")
  const [form, setForm] = useState<EntryForm>(() => defaultEntryForm())
  const imageInputRef = useRef<HTMLInputElement>(null)

  const selectedSupplier = useMemo(() => data?.suppliers.find((supplier) => supplier.id === form.supplierId) || null, [data, form.supplierId])

  const handleLocked = () => {
    const returnTo = "/admin/pos/suppliers?posFullscreen=1"
    window.location.assign(`/admin/pos?returnTo=${encodeURIComponent(returnTo)}`)
  }

  const loadAccounts = async () => {
    setError("")
    try {
      const response = await fetch("/api/pos/suppliers", { cache: "no-store" })
      const result = await response.json().catch(() => ({}))
      if (response.status === 423) return handleLocked()
      if (!response.ok) throw new Error(result.error || "Could not load supplier accounts.")
      setData(result)
    } catch (loadError) {
      console.error("Could not load supplier accounts", loadError)
      setError(loadError instanceof Error ? loadError.message : "Could not load supplier accounts.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadAccounts() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openEntry = (entryType: "BILL" | "PAYMENT", supplierId = "") => {
    setForm(defaultEntryForm(entryType, supplierId))
    setError("")
    setImageUploadNotice("")
    setImageUploadError("")
    setEntryOpen(true)
  }

  const addSupplier = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true); setError(""); setSuccess("")
    try {
      const response = await fetch("/api/pos/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: supplierName, notes: supplierNotes }),
      })
      const result = await response.json().catch(() => ({}))
      if (response.status === 423) return handleLocked()
      if (!response.ok) throw new Error(result.error || "Could not add supplier.")
      setSupplierOpen(false); setSupplierName(""); setSupplierNotes("")
      setSuccess(`${result.name} is ready to use.`)
      await loadAccounts()
    } catch (saveError) {
      console.error("Could not add supplier", saveError)
      setError(saveError instanceof Error ? saveError.message : "Could not add supplier.")
    } finally { setSaving(false) }
  }

  const uploadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    if (form.imageUrls.length + files.length > 6) {
      setImageUploadError("Add no more than 6 supporting images.")
      event.target.value = ""
      return
    }
    setUploading(true)
    setImageUploadNotice("")
    setImageUploadError("")
    try {
      const uploaded: string[] = []
      for (const file of files) {
        const body = new FormData()
        body.append("file", await prepareImageForUpload(file))
        const response = await fetch("/api/upload", { method: "POST", body })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result.url) throw new Error(result.error || `Could not upload ${file.name}.`)
        uploaded.push(result.url)
      }
      setForm((current) => ({ ...current, imageUrls: [...current.imageUrls, ...uploaded] }))
      setImageUploadNotice(`${uploaded.length} ${uploaded.length === 1 ? "image" : "images"} added to this entry.`)
    } catch (uploadError) {
      console.error("Supplier document upload failed", uploadError)
      setImageUploadError(uploadError instanceof Error ? uploadError.message : "Could not upload that image.")
    } finally { setUploading(false); event.target.value = "" }
  }

  const saveEntry = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true); setError(""); setSuccess("")
    try {
      const response = await fetch("/api/pos/supplier-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      })
      const result = await response.json().catch(() => ({}))
      if (response.status === 423) return handleLocked()
      if (!response.ok) throw new Error(result.error || "Could not save this supplier entry.")
      setEntryOpen(false)
      setSuccess(`${ENTRY_TYPES[form.entryType]} recorded for ${result.supplier.name}.`)
      await loadAccounts()
    } catch (saveError) {
      console.error("Could not save supplier ledger entry", saveError)
      setError(saveError instanceof Error ? saveError.message : "Could not save this supplier entry.")
    } finally { setSaving(false) }
  }

  const voidLedgerEntry = async () => {
    if (!voidEntry) return
    setSaving(true); setError(""); setSuccess("")
    try {
      const response = await fetch(`/api/pos/supplier-ledger/${voidEntry.id}/void`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: voidReason }),
      })
      const result = await response.json().catch(() => ({}))
      if (response.status === 423) return handleLocked()
      if (!response.ok) throw new Error(result.error || "Could not void this entry.")
      setVoidEntry(null); setVoidReason(""); setSuccess("Supplier entry voided. Balances have been recalculated.")
      await loadAccounts()
    } catch (voidError) {
      console.error("Could not void supplier entry", voidError)
      setError(voidError instanceof Error ? voidError.message : "Could not void this entry.")
    } finally { setSaving(false) }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">POS accounting</p>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">Supplier Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bills increase the balance. Full or partial payments reduce it without erasing the history.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/admin/pos?posFullscreen=1"><ArrowLeft className="mr-2 h-4 w-4" />POS</Link></Button>
          <Button variant="outline" onClick={() => void loadAccounts()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          <Button variant="outline" onClick={() => setSupplierOpen(true)}><UsersRound className="mr-2 h-4 w-4" />Add supplier</Button>
          <Button onClick={() => openEntry("BILL")}><ReceiptText className="mr-2 h-4 w-4" />New bill</Button>
        </div>
      </header>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {success && <div className="flex items-center gap-2 rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm text-green-800"><CheckCircle2 className="h-4 w-4" />{success}</div>}

      {loading || !data ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div> : <>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardDescription>Outstanding debt</CardDescription><CardTitle className="text-xl sm:text-2xl">{formatPrice(data.summary.outstanding)}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Bills recorded</CardDescription><CardTitle className="text-xl sm:text-2xl">{formatPrice(data.summary.billsTotal)}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Payments recorded</CardDescription><CardTitle className="text-xl sm:text-2xl">{formatPrice(data.summary.paymentsTotal)}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Active suppliers</CardDescription><CardTitle className="text-xl sm:text-2xl">{data.summary.supplierCount}</CardTitle></CardHeader></Card>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.6fr)]">
          <Card className="h-fit">
            <CardHeader><CardTitle>Supplier balances</CardTitle><CardDescription>Choose a supplier to record a bill or payment.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {data.suppliers.length ? data.suppliers.map((supplier) => <div key={supplier.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{supplier.name}</p><p className="text-xs text-muted-foreground">{supplier.billCount} bills · {supplier.paymentCount} payments</p></div><p className="shrink-0 font-semibold">{formatPrice(supplier.balance)}</p></div>
                <div className="mt-3 grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={() => openEntry("BILL", supplier.id)}><Plus className="mr-1 h-3.5 w-3.5" />Bill</Button><Button size="sm" variant="outline" disabled={supplier.balance <= 0} onClick={() => openEntry("PAYMENT", supplier.id)}><Banknote className="mr-1 h-3.5 w-3.5" />Payment</Button></div>
              </div>) : <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"><UsersRound className="mx-auto mb-2 h-6 w-6" />Add your first supplier to begin.</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent ledger</CardTitle><CardDescription>Every bill and payment remains visible. Incorrect entries are voided with a reason.</CardDescription></CardHeader>
            <CardContent>
              {data.recentEntries.length ? <div className="divide-y divide-border">{data.recentEntries.map((entry) => {
                const images = parseImages(entry.imageUrls)
                return <div key={entry.id} className={`py-4 ${entry.voidedAt ? "opacity-55" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{entry.supplier.name}</p><Badge variant={entry.entryType === "BILL" ? "secondary" : "outline"}>{ENTRY_TYPES[entry.entryType]}</Badge>{entry.voidedAt && <Badge variant="destructive">Voided</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{readableDate(entry.businessDate)} · {entry.createdBy?.name || entry.createdBy?.email || "Staff"}{entry.paymentMethod ? ` · ${entry.paymentMethod.replace(/_/g, " ")}` : ""}</p></div>
                    <p className={`shrink-0 font-semibold ${entry.entryType === "PAYMENT" ? "text-green-700" : ""}`}>{entry.entryType === "PAYMENT" ? "−" : "+"}{formatPrice(entry.amount)}</p>
                  </div>
                  {(entry.description || entry.reference) && <p className="mt-2 text-sm text-muted-foreground">{entry.description}{entry.reference ? `${entry.description ? " · " : ""}Ref: ${entry.reference}` : ""}</p>}
                  {images.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto">{images.map((image) => <a key={image} href={image} target="_blank" rel="noreferrer" className="shrink-0"><img src={image} alt="Supplier document" className="h-16 w-16 rounded border object-cover" /></a>)}</div>}
                  {entry.voidedAt ? <p className="mt-2 text-xs text-destructive">Voided: {entry.voidReason}</p> : <Button size="sm" variant="ghost" className="mt-2 h-8 px-2 text-muted-foreground" onClick={() => { setVoidEntry(entry); setVoidReason("") }}><RotateCcw className="mr-1 h-3.5 w-3.5" />Void incorrect entry</Button>}
                </div>
              })}</div> : <p className="py-10 text-center text-sm text-muted-foreground">No supplier activity yet.</p>}
            </CardContent>
          </Card>
        </div>
      </>}

      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-lg"><form onSubmit={addSupplier}>
          <DialogHeader><DialogTitle>Add supplier</DialogTitle><DialogDescription>Only the name is required. It will become available in the quick-select list.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-5"><div className="space-y-2"><Label htmlFor="supplierName">Supplier name</Label><Input id="supplierName" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} autoFocus required /></div><div className="space-y-2"><Label htmlFor="supplierNotes">Notes</Label><Textarea id="supplierNotes" value={supplierNotes} onChange={(event) => setSupplierNotes(event.target.value)} placeholder="Contact or account notes (optional)" /></div></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setSupplierOpen(false)}>Cancel</Button><Button disabled={saving || supplierName.trim().length < 2}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add supplier</Button></DialogFooter>
        </form></DialogContent>
      </Dialog>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="grid max-h-[92dvh] max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b p-5"><DialogTitle>{ENTRY_TYPES[form.entryType]}</DialogTitle><DialogDescription>{form.entryType === "BILL" ? "Adds to the supplier balance and today’s report." : "Records a full or partial payment and reduces the supplier balance."}</DialogDescription></DialogHeader>
          <form id="supplier-entry-form" onSubmit={saveEntry} className="space-y-5 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-2"><Button type="button" variant={form.entryType === "BILL" ? "default" : "outline"} onClick={() => setForm((current) => ({ ...current, entryType: "BILL" }))}><FileText className="mr-2 h-4 w-4" />Bill received</Button><Button type="button" variant={form.entryType === "PAYMENT" ? "default" : "outline"} onClick={() => setForm((current) => ({ ...current, entryType: "PAYMENT" }))}><WalletCards className="mr-2 h-4 w-4" />Payment</Button></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Supplier</Label><Select value={form.supplierId} onValueChange={(value) => setForm((current) => ({ ...current, supplierId: value }))}><SelectTrigger><SelectValue placeholder="Choose supplier" /></SelectTrigger><SelectContent>{data?.suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name} · {formatPrice(supplier.balance)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="entryDate">Accounting date</Label><Input id="entryDate" type="date" value={form.businessDate} onChange={(event) => setForm((current) => ({ ...current, businessDate: event.target.value }))} required /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="entryAmount">Amount (IDR)</Label><Input id="entryAmount" type="number" min="1" step="1" inputMode="numeric" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required /></div>{form.entryType === "PAYMENT" && <div className="space-y-2"><Label>Paid by</Label><Select value={form.paymentMethod} onValueChange={(value) => setForm((current) => ({ ...current, paymentMethod: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="TRANSFER">Transfer</SelectItem><SelectItem value="QRIS">QRIS</SelectItem><SelectItem value="CARD_MACHINE">Card machine</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></div>}</div>
            {form.entryType === "PAYMENT" && selectedSupplier && <div className="rounded-md bg-muted px-3 py-2 text-sm">Current balance: <strong>{formatPrice(selectedSupplier.balance)}</strong></div>}
            <div className="space-y-2"><Label htmlFor="entryDescription">Description</Label><Textarea id="entryDescription" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder={form.entryType === "BILL" ? "Invoice period, goods received, or useful details" : "Partial payment or account period"} /></div>
            <div className="space-y-2"><Label htmlFor="entryReference">Invoice or payment reference</Label><Input id="entryReference" value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Optional" /></div>
            <div className="space-y-3"><div className="flex items-center justify-between gap-3"><div><Label htmlFor="supplier-entry-images">Supporting images</Label><p className="text-xs text-muted-foreground">Photograph the bill or choose images from the device. Up to 6 images.</p></div><input ref={imageInputRef} id="supplier-entry-images" type="file" accept="image/*,.heic,.heif,.avif" multiple className="hidden" onChange={uploadImages} disabled={uploading} /><Button type="button" variant="outline" size="sm" disabled={uploading || form.imageUrls.length >= 6} onClick={() => imageInputRef.current?.click()}>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}{uploading ? "Uploading" : "Add image"}</Button></div>
              {imageUploadNotice && <p className="flex items-center gap-2 rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-800"><CheckCircle2 className="h-4 w-4" />{imageUploadNotice}</p>}
              {imageUploadError && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{imageUploadError}</p>}
              {form.imageUrls.length > 0 && <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{form.imageUrls.map((image, index) => <div key={image} className="group relative aspect-square overflow-hidden rounded-md border"><img src={image} alt={`Supporting document ${index + 1}`} className="h-full w-full object-cover" /><button type="button" aria-label="Remove image" className="absolute right-1 top-1 rounded bg-background/90 p-1 shadow" onClick={() => setForm((current) => ({ ...current, imageUrls: current.imageUrls.filter((_, imageIndex) => imageIndex !== index) }))}><X className="h-4 w-4" /></button></div>)}</div>}
            </div>
          </form>
          <DialogFooter className="border-t p-4"><Button type="button" variant="outline" onClick={() => setEntryOpen(false)}>Cancel</Button><Button type="submit" form="supplier-entry-form" disabled={saving || uploading || !form.supplierId || !form.amount}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record {form.entryType === "BILL" ? "bill" : "payment"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(voidEntry)} onOpenChange={(open) => !open && setVoidEntry(null)}><DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-md"><DialogHeader><DialogTitle>Void supplier entry?</DialogTitle><DialogDescription>This preserves the original record but removes its amount from balances and reports.</DialogDescription></DialogHeader><div className="space-y-2 py-4"><Label htmlFor="voidReason">Reason</Label><Textarea id="voidReason" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Duplicate bill, incorrect amount, wrong supplier…" /></div><DialogFooter><Button variant="outline" onClick={() => setVoidEntry(null)}>Cancel</Button><Button variant="destructive" disabled={saving || voidReason.trim().length < 3} onClick={voidLedgerEntry}><Trash2 className="mr-2 h-4 w-4" />Void entry</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}
