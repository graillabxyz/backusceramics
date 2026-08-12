"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Banknote, CheckCircle2, CircleDollarSign, HandCoins, Loader2, Plus, RefreshCw, RotateCcw, WalletCards } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatPrice } from "@/lib/pos-catalog"

const BALI_OFFSET = 8 * 60 * 60 * 1000

interface Person { id: string; name: string | null; email: string }
interface CashOutEntry {
  id: string
  fundingSource: "REGISTER" | "STAFF"
  amount: number
  businessDate: string
  description: string
  createdAt: string
  createdBy: Person
  staffMember: Person | null
  reimbursedAt: string | null
  reimbursedBusinessDate: string | null
  reimbursementMethod: string | null
  reimbursementNote: string | null
  reimbursedBy: Person | null
  voidedAt: string | null
  voidReason: string | null
  voidedBy: Person | null
}

interface CashOutResponse {
  entries: CashOutEntry[]
  summary: {
    registerCashOutTotal: number
    staffFundedTotal: number
    staffReimbursedTotal: number
    outstandingStaffDebt: number
    openStaffClaims: number
  }
}

function todayBali() { return new Date(Date.now() + BALI_OFFSET).toISOString().slice(0, 10) }
function readableDate(value: string) { return new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) }
function personLabel(person: Person | null | undefined) { return person?.name || person?.email || "Staff" }

export default function CashAndReimbursementsPage() {
  const [data, setData] = useState<CashOutResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [newOpen, setNewOpen] = useState(false)
  const [fundingSource, setFundingSource] = useState<"REGISTER" | "STAFF">("REGISTER")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [businessDate, setBusinessDate] = useState(todayBali())
  const [reimburseEntry, setReimburseEntry] = useState<CashOutEntry | null>(null)
  const [reimbursementMethod, setReimbursementMethod] = useState("TRANSFER")
  const [reimbursementDate, setReimbursementDate] = useState(todayBali())
  const [reimbursementNote, setReimbursementNote] = useState("")
  const [voidEntry, setVoidEntry] = useState<CashOutEntry | null>(null)
  const [voidReason, setVoidReason] = useState("")

  const openClaims = useMemo(() => data?.entries.filter((entry) => entry.fundingSource === "STAFF" && !entry.reimbursedAt && !entry.voidedAt) || [], [data])
  const activeEntries = useMemo(() => data?.entries.filter((entry) => !entry.voidedAt) || [], [data])

  const handleLocked = () => window.location.assign(`/admin/pos?returnTo=${encodeURIComponent("/admin/pos/cash-outs?posFullscreen=1")}`)
  const loadEntries = async () => {
    setError("")
    try {
      const response = await fetch("/api/pos/cash-outs", { cache: "no-store" })
      const result = await response.json().catch(() => ({}))
      if (response.status === 423) return handleLocked()
      if (!response.ok) throw new Error(result.error || "Could not load cash activity.")
      setData(result)
    } catch (loadError) {
      console.error("Could not load cash and reimbursements", loadError)
      setError(loadError instanceof Error ? loadError.message : "Could not load cash activity.")
    } finally { setLoading(false) }
  }
  useEffect(() => { void loadEntries() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => { setFundingSource("REGISTER"); setAmount(""); setDescription(""); setBusinessDate(todayBali()); setNewOpen(true) }
  const saveNew = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("")
    try {
      const response = await fetch("/api/pos/cash-outs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fundingSource, amount: Number(amount), description, businessDate }) })
      const result = await response.json().catch(() => ({}))
      if (response.status === 423) return handleLocked()
      if (!response.ok) throw new Error(result.error || "Could not record this cash out.")
      setNewOpen(false); setSuccess(fundingSource === "REGISTER" ? "Register cash out recorded." : `The business now owes ${personLabel(result.staffMember)} ${formatPrice(result.amount)}.`)
      await loadEntries()
    } catch (saveError) { console.error("Could not save cash out", saveError); setError(saveError instanceof Error ? saveError.message : "Could not record this cash out.") } finally { setSaving(false) }
  }

  const reimburse = async () => {
    if (!reimburseEntry) return
    setSaving(true); setError(""); setSuccess("")
    try {
      const response = await fetch(`/api/pos/cash-outs/${reimburseEntry.id}/reimburse`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: reimbursementMethod, businessDate: reimbursementDate, note: reimbursementNote }) })
      const result = await response.json().catch(() => ({}))
      if (response.status === 423) return handleLocked()
      if (!response.ok) throw new Error(result.error || "Could not record the reimbursement.")
      setReimburseEntry(null); setReimbursementNote(""); setSuccess("Staff reimbursement recorded and removed from open debt."); await loadEntries()
    } catch (saveError) { console.error("Could not reimburse staff cash out", saveError); setError(saveError instanceof Error ? saveError.message : "Could not record the reimbursement.") } finally { setSaving(false) }
  }

  const voidCashOut = async () => {
    if (!voidEntry) return
    setSaving(true); setError(""); setSuccess("")
    try {
      const response = await fetch(`/api/pos/cash-outs/${voidEntry.id}/void`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: voidReason }) })
      const result = await response.json().catch(() => ({}))
      if (response.status === 423) return handleLocked()
      if (!response.ok) throw new Error(result.error || "Could not void this entry.")
      setVoidEntry(null); setVoidReason(""); setSuccess("Incorrect cash entry voided. Reports have been recalculated."); await loadEntries()
    } catch (saveError) { console.error("Could not void cash out", saveError); setError(saveError instanceof Error ? saveError.message : "Could not void this entry.") } finally { setSaving(false) }
  }

  return <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">POS accounting</p><h1 className="font-heading text-2xl font-bold sm:text-3xl">Cash & Reimbursements</h1><p className="mt-1 text-sm text-muted-foreground">Register cash outs reduce drawer cash. Staff-paid purchases remain visible until reimbursed.</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/admin/pos?posFullscreen=1"><ArrowLeft className="mr-2 h-4 w-4" />POS</Link></Button><Button variant="outline" onClick={() => void loadEntries()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Cash out</Button></div></header>
    {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    {success && <div className="flex items-center gap-2 rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm text-green-800"><CheckCircle2 className="h-4 w-4" />{success}</div>}
    {loading || !data ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div> : <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Card><CardHeader className="pb-2"><CardDescription>Owed to staff</CardDescription><CardTitle className="text-xl sm:text-2xl">{formatPrice(data.summary.outstandingStaffDebt)}</CardTitle><p className="text-xs text-muted-foreground">{data.summary.openStaffClaims} open claim{data.summary.openStaffClaims === 1 ? "" : "s"}</p></CardHeader></Card><Card><CardHeader className="pb-2"><CardDescription>Register cash outs</CardDescription><CardTitle className="text-xl sm:text-2xl">{formatPrice(data.summary.registerCashOutTotal)}</CardTitle></CardHeader></Card><Card><CardHeader className="pb-2"><CardDescription>Staff funded</CardDescription><CardTitle className="text-xl sm:text-2xl">{formatPrice(data.summary.staffFundedTotal)}</CardTitle></CardHeader></Card><Card><CardHeader className="pb-2"><CardDescription>Staff reimbursed</CardDescription><CardTitle className="text-xl sm:text-2xl">{formatPrice(data.summary.staffReimbursedTotal)}</CardTitle></CardHeader></Card></section>
      {openClaims.length > 0 && <Card><CardHeader><CardTitle className="flex items-center gap-2"><HandCoins className="h-5 w-5" />Open Staff Reimbursements</CardTitle><CardDescription>These amounts are liabilities owed by the business and stay here until settled.</CardDescription></CardHeader><CardContent className="divide-y divide-border">{openClaims.map((entry) => <div key={entry.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{entry.description}</p><p className="text-sm text-muted-foreground">{personLabel(entry.staffMember)} · {readableDate(entry.businessDate)}</p></div><div className="flex items-center gap-3"><p className="font-semibold">{formatPrice(entry.amount)}</p><Button size="sm" onClick={() => { setReimburseEntry(entry); setReimbursementMethod("TRANSFER"); setReimbursementDate(todayBali()); setReimbursementNote("") }}>Mark reimbursed</Button></div></div>)}</CardContent></Card>}
      <Card><CardHeader><CardTitle>Cash activity</CardTitle><CardDescription>Every entry remains auditable. Corrections are voided with a reason rather than deleted.</CardDescription></CardHeader><CardContent>{activeEntries.length ? <div className="divide-y divide-border">{data.entries.map((entry) => <div key={entry.id} className={`py-4 ${entry.voidedAt ? "opacity-50" : ""}`}><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{entry.description}</p><Badge variant={entry.fundingSource === "REGISTER" ? "secondary" : "outline"}>{entry.fundingSource === "REGISTER" ? "Register cash" : "Staff paid"}</Badge>{entry.reimbursedAt && <Badge className="bg-green-100 text-green-800">Reimbursed</Badge>}{entry.voidedAt && <Badge variant="destructive">Voided</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{readableDate(entry.businessDate)} · entered by {personLabel(entry.createdBy)}{entry.staffMember ? ` · owed to ${personLabel(entry.staffMember)}` : ""}</p></div><p className="shrink-0 font-semibold">{formatPrice(entry.amount)}</p></div>{entry.reimbursedAt && <p className="mt-2 text-sm text-muted-foreground">Reimbursed {entry.reimbursedBusinessDate ? readableDate(entry.reimbursedBusinessDate) : ""} by {personLabel(entry.reimbursedBy)} via {(entry.reimbursementMethod || "OTHER").replace(/_/g, " ")}{entry.reimbursementNote ? ` · ${entry.reimbursementNote}` : ""}</p>}{entry.voidedAt ? <p className="mt-2 text-xs text-destructive">Voided: {entry.voidReason}</p> : !entry.reimbursedAt && <Button size="sm" variant="ghost" className="mt-2 h-8 px-2 text-muted-foreground" onClick={() => { setVoidEntry(entry); setVoidReason("") }}><RotateCcw className="mr-1 h-3.5 w-3.5" />Void incorrect entry</Button>}</div>)}</div> : <p className="py-10 text-center text-sm text-muted-foreground">No cash activity yet.</p>}</CardContent></Card>
    </>}

    <Dialog open={newOpen} onOpenChange={setNewOpen}><DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-lg"><form onSubmit={saveNew}><DialogHeader><DialogTitle>Record cash out</DialogTitle><DialogDescription>Use register cash, or record a staff-funded purchase as money the business owes that staff member.</DialogDescription></DialogHeader><div className="space-y-5 py-5"><div className="grid grid-cols-2 gap-2"><Button type="button" variant={fundingSource === "REGISTER" ? "default" : "outline"} className="h-auto min-h-16 whitespace-normal" onClick={() => setFundingSource("REGISTER")}><Banknote className="mr-2 h-4 w-4" />Register cash</Button><Button type="button" variant={fundingSource === "STAFF" ? "default" : "outline"} className="h-auto min-h-16 whitespace-normal" onClick={() => setFundingSource("STAFF")}><WalletCards className="mr-2 h-4 w-4" />I paid personally</Button></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="cashDate">Accounting date</Label><Input id="cashDate" type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="cashAmount">Amount (IDR)</Label><Input id="cashAmount" type="number" min="1" step="1" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div></div><div className="space-y-2"><Label htmlFor="cashDescription">What was purchased?</Label><Textarea id="cashDescription" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Urgent gas refill, courier fee, market supplies…" required /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button><Button disabled={saving || !amount || description.trim().length < 3}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record cash out</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={Boolean(reimburseEntry)} onOpenChange={(open) => !open && setReimburseEntry(null)}><DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-md"><DialogHeader><DialogTitle>Reimburse {personLabel(reimburseEntry?.staffMember)}</DialogTitle><DialogDescription>{reimburseEntry ? `${formatPrice(reimburseEntry.amount)} for ${reimburseEntry.description}` : "Record this reimbursement."}</DialogDescription></DialogHeader><div className="space-y-4 py-4"><div className="space-y-2"><Label>Paid from</Label><Select value={reimbursementMethod} onValueChange={setReimbursementMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TRANSFER">Bank transfer</SelectItem><SelectItem value="REGISTER_CASH">Register cash</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="reimbursementDate">Accounting date</Label><Input id="reimbursementDate" type="date" value={reimbursementDate} onChange={(event) => setReimbursementDate(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="reimbursementNote">Note</Label><Textarea id="reimbursementNote" value={reimbursementNote} onChange={(event) => setReimbursementNote(event.target.value)} placeholder="Transfer reference or useful detail (optional)" /></div>{reimbursementMethod === "REGISTER_CASH" && <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">This reimbursement will reduce expected register cash on the selected date.</p>}</div><DialogFooter><Button variant="outline" onClick={() => setReimburseEntry(null)}>Cancel</Button><Button onClick={reimburse} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark reimbursed</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(voidEntry)} onOpenChange={(open) => !open && setVoidEntry(null)}><DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-md"><DialogHeader><DialogTitle>Void cash entry?</DialogTitle><DialogDescription>This preserves the audit trail but removes the amount from reports and outstanding staff debt.</DialogDescription></DialogHeader><div className="space-y-2 py-4"><Label htmlFor="voidCashReason">Reason</Label><Textarea id="voidCashReason" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Duplicate, wrong amount, entered against the wrong purchase…" /></div><DialogFooter><Button variant="outline" onClick={() => setVoidEntry(null)}>Cancel</Button><Button variant="destructive" disabled={saving || voidReason.trim().length < 3} onClick={voidCashOut}><RotateCcw className="mr-2 h-4 w-4" />Void entry</Button></DialogFooter></DialogContent></Dialog>
  </div>
}
