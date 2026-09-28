"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, CheckCircle2, Download, ExternalLink, Gift, Keyboard, Loader2, ScanLine, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatPrice } from "@/lib/pos-catalog"

export interface PosGiftVoucher {
  code: string
  token: string
  type: "CLASS" | "CASH"
  status: "PENDING_PAYMENT" | "ACTIVE" | "REDEEMED" | "CANCELLED"
  classDays: number | null
  participants: number
  initialAmount: number
  remainingAmount: number
  remainingClassDays: number
  recipientName: string | null
  title: string
}

export interface AppliedCashGiftVoucher {
  code: string
  token: string
  amount: number
  remainingAmount: number
}

interface BarcodeResultLike { rawValue: string }
interface BarcodeDetectorLike { detect(source: HTMLVideoElement): Promise<BarcodeResultLike[]> }
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

export function PosGiftVoucherDialog({
  payableAmount,
  appliedCashVoucher,
  onApplyCash,
  onClearCash,
  onPosLocked,
}: {
  payableAmount: number
  appliedCashVoucher: AppliedCashGiftVoucher | null
  onApplyCash: (voucher: AppliedCashGiftVoucher) => void
  onClearCash: () => void
  onPosLocked: (message?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [lookup, setLookup] = useState("")
  const [voucher, setVoucher] = useState<PosGiftVoucher | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanTimerRef = useRef<number | null>(null)

  const stopCamera = () => {
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current)
    scanTimerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setScanning(false)
  }

  useEffect(() => () => stopCamera(), [])

  const readVoucher = async (value = lookup) => {
    const clean = value.trim()
    if (!clean) { setError("Scan a QR code or enter the voucher code."); return }
    setLoading(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/pos/gift-vouchers/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookup: clean }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 423) { onPosLocked(data.error); setOpen(false); return }
      if (!response.ok) throw new Error(data.error || "Voucher could not be found.")
      setVoucher(data.voucher)
      setLookup(data.voucher.code)
    } catch (lookupError) {
      setVoucher(null)
      setError(lookupError instanceof Error ? lookupError.message : "Voucher could not be found.")
    } finally {
      setLoading(false)
    }
  }

  const startCamera = async () => {
    setError("")
    setNotice("")
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
    if (!Detector) { setError("QR camera scanning is not supported in this browser. Enter the voucher code instead."); return }
    if (!navigator.mediaDevices?.getUserMedia) { setError("Camera access is not available. Enter the voucher code instead."); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      streamRef.current = stream
      setScanning(true)
      await new Promise<void>((resolve) => window.setTimeout(resolve, 50))
      const video = videoRef.current
      if (!video) throw new Error("Camera preview could not be opened.")
      video.srcObject = stream
      await video.play()
      const detector = new Detector({ formats: ["qr_code"] })
      const scan = async () => {
        try {
          const results = await detector.detect(video)
          if (results[0]?.rawValue) {
            const value = results[0].rawValue
            stopCamera()
            setLookup(value)
            await readVoucher(value)
            return
          }
        } catch {
          // A video frame can be unavailable while the camera initializes; keep scanning.
        }
        scanTimerRef.current = window.setTimeout(() => void scan(), 250)
      }
      void scan()
    } catch (cameraError) {
      stopCamera()
      setError(cameraError instanceof Error ? cameraError.message : "Camera access was not granted.")
    }
  }

  const redeemClassDay = async () => {
    if (!voucher) return
    setRedeeming(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/pos/gift-vouchers/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookup: voucher.token }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 423) { onPosLocked(data.error); setOpen(false); return }
      if (!response.ok) throw new Error(data.error || "Voucher could not be redeemed.")
      setVoucher(data.voucher)
      setNotice(data.message || "Class day redeemed.")
    } catch (redeemError) {
      setError(redeemError instanceof Error ? redeemError.message : "Voucher could not be redeemed.")
    } finally {
      setRedeeming(false)
    }
  }

  const applyCash = () => {
    if (!voucher || voucher.type !== "CASH") return
    const amount = Math.min(voucher.remainingAmount, payableAmount)
    if (amount <= 0) { setError("Add items to the cart before applying this cash voucher."); return }
    onApplyCash({ code: voucher.code, token: voucher.token, amount, remainingAmount: voucher.remainingAmount })
    setNotice(`${formatPrice(amount)} will be applied at checkout.`)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) stopCamera() }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-10 px-3"><Gift className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Gift voucher</span></Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5" /> Scan gift voucher</DialogTitle>
          <DialogDescription>Use the camera QR scanner or enter the printed voucher code.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {scanning ? (
            <div className="relative overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} muted playsInline className="aspect-square w-full object-cover sm:aspect-video" />
              <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/80" />
              <Button type="button" size="sm" variant="secondary" className="absolute right-3 top-3" onClick={stopCamera}><X className="mr-1 h-4 w-4" /> Stop</Button>
            </div>
          ) : (
            <Button type="button" variant="secondary" className="h-12 w-full" onClick={() => void startCamera()}><Camera className="mr-2 h-5 w-5" /> Open camera scanner</Button>
          )}

          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="giftVoucherLookup" className="flex items-center gap-2"><Keyboard className="h-4 w-4" /> Voucher code</Label><Input id="giftVoucherLookup" value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="BACKUS-..." onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void readVoucher() } }} /></div>
            <Button type="button" onClick={() => void readVoucher()} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}</Button>
          </div>

          {voucher && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{voucher.title}</p><p className="font-mono text-xs text-muted-foreground">{voucher.code}</p></div><span className="rounded-full border px-2 py-1 text-xs font-medium">{voucher.status.replace(/_/g, " ")}</span></div>
              {voucher.recipientName && <p className="text-sm text-muted-foreground">For {voucher.recipientName}</p>}
              {voucher.type === "CLASS" ? (
                <><p className="text-sm"><strong>{voucher.remainingClassDays}</strong> of {voucher.classDays} class days remaining for <strong>{voucher.participants}</strong> {voucher.participants === 1 ? "person" : "people"}.</p><Button type="button" className="w-full" onClick={() => void redeemClassDay()} disabled={redeeming || voucher.status !== "ACTIVE" || voucher.remainingClassDays < 1}>{redeeming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Redeem one class day</Button></>
              ) : (
                <><p className="text-sm">Available balance: <strong>{formatPrice(voucher.remainingAmount)}</strong></p>{appliedCashVoucher?.code === voucher.code ? <Button type="button" variant="outline" className="w-full" onClick={onClearCash}>Remove from sale</Button> : <Button type="button" className="w-full" onClick={applyCash} disabled={voucher.status !== "ACTIVE" || voucher.remainingAmount <= 0 || payableAmount <= 0}>Apply to current sale</Button>}</>
              )}
              {(voucher.status === "ACTIVE" || voucher.status === "REDEEMED") && (
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                  <Button asChild variant="outline"><a href={`/gift-cards/v/${encodeURIComponent(voucher.token)}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />View voucher</a></Button>
                  <Button asChild variant="outline"><a href={`/api/gift-vouchers/${encodeURIComponent(voucher.token)}/download`}><Download className="mr-2 h-4 w-4" />Export PDF</a></Button>
                </div>
              )}
            </div>
          )}

          {notice && <p className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{notice}</p>}
          {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
