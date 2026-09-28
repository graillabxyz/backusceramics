"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Download, Loader2 } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"

function GiftVoucherSuccessContent() {
  const params = useSearchParams()
  const token = params.get("token") || ""
  const [status, setStatus] = useState("PENDING_PAYMENT")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) { setError("Gift voucher link is missing."); return }
    let attempts = 0
    let timer: number | undefined
    const check = async () => {
      attempts += 1
      try {
        const response = await fetch(`/api/gift-vouchers/${encodeURIComponent(token)}`, { cache: "no-store" })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || "Voucher status could not be checked.")
        setStatus(data.voucher.status)
        setCode(data.voucher.code)
        if (data.voucher.status === "PENDING_PAYMENT" && attempts < 20) timer = window.setTimeout(check, 3000)
      } catch (statusError) {
        setError(statusError instanceof Error ? statusError.message : "Voucher status could not be checked.")
      }
    }
    void check()
    return () => { if (timer) window.clearTimeout(timer) }
  }, [token])

  const ready = status === "ACTIVE" || status === "REDEEMED"
  return <main className="min-h-screen bg-background"><Navigation /><section className="mx-auto flex min-h-[75vh] max-w-2xl items-center px-4 pt-24"><div className="w-full rounded-xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">{ready ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /> : <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />}<h1 className="mt-5 font-heading text-3xl font-bold">{ready ? "Your gift voucher is ready." : status === "CANCELLED" ? "Payment was cancelled." : "Confirming your payment..."}</h1><p className="mt-3 text-muted-foreground">{ready ? `Voucher ${code} has been emailed and is ready to download.` : "This normally takes only a few seconds. Keep this page open while we confirm it."}</p>{error && <p className="mt-4 text-sm text-destructive">{error}</p>}<div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">{ready && <><Button asChild><Link href={`/gift-cards/v/${encodeURIComponent(token)}`}>View voucher</Link></Button><Button asChild variant="outline"><a href={`/api/gift-vouchers/${encodeURIComponent(token)}/download`}><Download className="mr-2 h-4 w-4" />Download PDF</a></Button></>}<Button asChild variant="ghost"><Link href="/gift-cards">Buy another gift</Link></Button></div></div></section><Footer /></main>
}

export default function GiftVoucherSuccessPage() {
  return <Suspense fallback={<div className="min-h-screen bg-background" />}><GiftVoucherSuccessContent /></Suspense>
}
