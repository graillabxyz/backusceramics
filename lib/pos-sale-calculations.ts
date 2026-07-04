export const POS_TAX_RATES = [0, 10, 15] as const

export type PosTaxRate = (typeof POS_TAX_RATES)[number]
export type PosDiscountType = "NONE" | "PERCENT" | "AMOUNT"

export interface PosLineCalculationInput {
  unitPrice: number
  quantity: number
  taxRate?: unknown
  discountType?: unknown
  discountValue?: unknown
}

export interface PosLineCalculation {
  subtotal: number
  discountAmount: number
  taxRate: PosTaxRate
  taxAmount: number
  total: number
}

export function normalizePosTaxRate(value: unknown): PosTaxRate {
  const taxRate = Number(value || 0)
  return POS_TAX_RATES.includes(taxRate as PosTaxRate) ? (taxRate as PosTaxRate) : 0
}

export function normalizePosDiscountType(value: unknown): PosDiscountType {
  if (value === "PERCENT" || value === "AMOUNT") return value
  return "NONE"
}

export function calculatePosLineTotals(input: PosLineCalculationInput): PosLineCalculation {
  const unitPrice = Number.isFinite(input.unitPrice) ? Math.max(Math.round(input.unitPrice), 0) : 0
  const quantity = Number.isFinite(input.quantity) ? Math.max(Math.round(input.quantity), 0) : 0
  const subtotal = unitPrice * quantity
  const discountType = normalizePosDiscountType(input.discountType)
  const rawDiscountValue = Number(input.discountValue || 0)
  const discountValue = Number.isFinite(rawDiscountValue) ? Math.max(rawDiscountValue, 0) : 0
  const discountAmount = discountType === "PERCENT"
    ? Math.min(Math.round(subtotal * Math.min(discountValue, 100) / 100), subtotal)
    : discountType === "AMOUNT"
      ? Math.min(Math.round(discountValue), subtotal)
      : 0
  const taxableAmount = Math.max(subtotal - discountAmount, 0)
  const taxRate = normalizePosTaxRate(input.taxRate)
  const taxAmount = Math.round(taxableAmount * taxRate / 100)

  return {
    subtotal,
    discountAmount,
    taxRate,
    taxAmount,
    total: taxableAmount + taxAmount,
  }
}
