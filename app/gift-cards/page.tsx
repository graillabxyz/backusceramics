"use client"

import { Suspense, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Banknote, Gift, Loader2, Minus, Plus, Sparkles } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatPrice } from "@/lib/pos-catalog"
import { GIFT_VOUCHER_CLASS_PACKAGES, type GiftVoucherClassDays } from "@/lib/gift-vouchers"

const cashPresets = [500_000, 1_000_000, 2_500_000, 5_000_000]

function GiftCardsContent() {
  const searchParams = useSearchParams()
  const [type, setType] = useState<"CLASS" | "CASH">("CLASS")
  const [classDays, setClassDays] = useState<GiftVoucherClassDays>(1)
  const [participants, setParticipants] = useState(1)
  const [cashAmount, setCashAmount] = useState("1000000")
  const [purchaserName, setPurchaserName] = useState("")
  const [purchaserEmail, setPurchaserEmail] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const total = useMemo(() => type === "CLASS"
    ? GIFT_VOUCHER_CLASS_PACKAGES[classDays].unitPrice * participants
    : Number(cashAmount || 0), [cashAmount, classDays, participants, type])

  const checkout = async () => {
    setError("")
    setLoading(true)
    try {
      const response = await fetch("/api/gift-vouchers/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, classDays, participants, cashAmount: Number(cashAmount), purchaserName, purchaserEmail, recipientName, recipientEmail, message }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Gift voucher checkout could not be started.")
      if (!data.paymentUrl) throw new Error("Payment link was not returned.")
      window.location.href = data.paymentUrl
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Gift voucher checkout could not be started.")
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <section className="border-b border-border bg-secondary/25 pt-28 pb-12">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Gift className="h-7 w-7" /></div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Backus Ceramics gift cards</p>
          <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight sm:text-6xl">Give them time with clay.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Choose a class experience or any cash value. We email a printable voucher with a QR code that can be scanned at our studio.</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-7">
          {searchParams.get("payment") === "cancelled" && <p className="rounded-md border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">Payment was cancelled. Your voucher was not activated.</p>}
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant={type === "CLASS" ? "default" : "outline"} className="h-14" onClick={() => setType("CLASS")}><Sparkles className="mr-2 h-4 w-4" />Class voucher</Button>
            <Button type="button" variant={type === "CASH" ? "default" : "outline"} className="h-14" onClick={() => setType("CASH")}><Banknote className="mr-2 h-4 w-4" />Cash voucher</Button>
          </div>

          {type === "CLASS" ? (
            <div className="space-y-5">
              <div><h2 className="font-heading text-2xl font-bold">Choose the experience</h2><p className="text-sm text-muted-foreground">Package prices are per person.</p></div>
              <div className="grid gap-3 sm:grid-cols-3">
                {([1, 3, 6] as GiftVoucherClassDays[]).map((days) => {
                  const item = GIFT_VOUCHER_CLASS_PACKAGES[days]
                  return <button key={days} type="button" onClick={() => setClassDays(days)} className={`rounded-lg border p-4 text-left transition ${classDays === days ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"}`}><span className="block font-heading text-xl font-bold">{days} {days === 1 ? "day" : "days"}</span><span className="mt-1 block text-sm text-muted-foreground">{formatPrice(item.unitPrice)} / person</span></button>
                })}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4"><div><Label>Number of people</Label><p className="text-xs text-muted-foreground">The voucher covers the full package for everyone.</p></div><div className="flex items-center gap-3"><Button type="button" size="icon" variant="outline" onClick={() => setParticipants((value) => Math.max(1, value - 1))}><Minus className="h-4 w-4" /></Button><span className="w-6 text-center text-lg font-bold">{participants}</span><Button type="button" size="icon" variant="outline" onClick={() => setParticipants((value) => Math.min(12, value + 1))}><Plus className="h-4 w-4" /></Button></div></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div><h2 className="font-heading text-2xl font-bold">Choose any amount</h2><p className="text-sm text-muted-foreground">Cash vouchers can be used toward products or classes at the studio.</p></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{cashPresets.map((amount) => <Button key={amount} type="button" variant={Number(cashAmount) === amount ? "default" : "outline"} onClick={() => setCashAmount(String(amount))}>{formatPrice(amount)}</Button>)}</div>
              <div className="space-y-2"><Label htmlFor="cashGiftAmount">Custom amount (IDR)</Label><Input id="cashGiftAmount" inputMode="numeric" value={cashAmount} onChange={(event) => setCashAmount(event.target.value.replace(/\D/g, ""))} placeholder="1000000" /></div>
            </div>
          )}

          <div className="space-y-4 border-t border-border pt-7">
            <h2 className="font-heading text-2xl font-bold">Delivery details</h2>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="purchaserName">Your name</Label><Input id="purchaserName" value={purchaserName} onChange={(event) => setPurchaserName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="purchaserEmail">Your email</Label><Input id="purchaserEmail" type="email" value={purchaserEmail} onChange={(event) => setPurchaserEmail(event.target.value)} /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="recipientName">Recipient name <span className="text-muted-foreground">(optional)</span></Label><Input id="recipientName" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="recipientEmail">Email voucher directly to <span className="text-muted-foreground">(optional)</span></Label><Input id="recipientEmail" type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="Defaults to your email" /></div></div>
            <div className="space-y-2"><Label htmlFor="giftMessage">Personal message <span className="text-muted-foreground">(optional)</span></Label><Textarea id="giftMessage" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} rows={4} placeholder="A little note to include on the voucher..." /></div>
          </div>
        </div>

        <div>
          <Card className="sticky top-28"><CardContent className="space-y-5 p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your gift</p><h2 className="mt-2 font-heading text-2xl font-bold">{type === "CLASS" ? `${classDays} ${classDays === 1 ? "day" : "days"} for ${participants}` : "Cash gift voucher"}</h2></div><div className="border-t border-border pt-4"><div className="flex items-center justify-between"><span className="text-muted-foreground">Total</span><span className="text-2xl font-bold">{formatPrice(total)}</span></div></div><ul className="space-y-2 text-sm text-muted-foreground"><li>Printable PDF voucher</li><li>QR code for POS redemption</li><li>Emailed after confirmed payment</li></ul>{error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}<Button className="h-12 w-full" onClick={() => void checkout()} disabled={loading || total <= 0}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continue to secure payment</Button></CardContent></Card>
        </div>
      </section>
      <Footer />
    </main>
  )
}

export default function GiftCardsPage() {
  return <Suspense fallback={<div className="min-h-screen bg-background" />}><GiftCardsContent /></Suspense>
}
