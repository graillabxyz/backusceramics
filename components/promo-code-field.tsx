"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Loader2, TicketPercent, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface AppliedPromoCode {
  code: string
  discountAmount: number
  discountedSubtotal: number
  description: string | null
  discountType: "PERCENT" | "FIXED"
  discountValue: number
}

export function PromoCodeField({
  channel,
  subtotal,
  formatAmount,
  onChange,
}: {
  channel: "SHOP" | "CLASSES"
  subtotal: number
  formatAmount: (amount: number) => string
  onChange: (promo: AppliedPromoCode | null) => void
}) {
  const [code, setCode] = useState("")
  const [applied, setApplied] = useState<AppliedPromoCode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const appliedSubtotal = useRef<number | null>(null)

  useEffect(() => {
    if (!applied || appliedSubtotal.current === subtotal) return
    setApplied(null)
    appliedSubtotal.current = null
    onChange(null)
    setError("Your total changed. Apply the code again.")
  }, [applied, onChange, subtotal])

  const remove = () => {
    setApplied(null)
    appliedSubtotal.current = null
    setCode("")
    setError("")
    onChange(null)
  }

  const apply = async () => {
    const normalizedCode = code.trim().toUpperCase()
    if (!normalizedCode) {
      setError("Enter a promo code.")
      return
    }

    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/promos/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode, channel, subtotal }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || "Promo code could not be applied.")
      const promo = payload.promo as AppliedPromoCode
      setCode(promo.code)
      setApplied(promo)
      appliedSubtotal.current = subtotal
      onChange(promo)
    } catch (promoError) {
      setApplied(null)
      appliedSubtotal.current = null
      onChange(null)
      setError(promoError instanceof Error ? promoError.message : "Promo code could not be applied.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <TicketPercent className="h-4 w-4" />
        Promo code
      </div>
      {applied ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold"><Check className="h-4 w-4" />{applied.code}</p>
            <p className="truncate text-xs">You save {formatAmount(applied.discountAmount)}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={remove} aria-label="Remove promo code">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase())
              setError("")
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void apply()
              }
            }}
            placeholder="Enter code"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={32}
          />
          <Button type="button" variant="outline" onClick={() => void apply()} disabled={loading || subtotal <= 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
