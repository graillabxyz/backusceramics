import {
  isValidPromoCodeFormat,
  normalizePromoCode,
  PROMO_DISCOUNT_TYPES,
  PROMO_SCOPES,
  type PromoDiscountType,
  type PromoScope,
} from "@/lib/promo-codes"
import { cleanString } from "@/lib/server-security"

function parseOptionalPositiveInteger(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return { value: null }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return { value: null, error: `${label} must be a positive whole number.` }
  return { value: parsed }
}

function parseNonNegativeInteger(value: unknown, label: string) {
  const parsed = Number(value || 0)
  if (!Number.isInteger(parsed) || parsed < 0) return { value: 0, error: `${label} must be zero or higher.` }
  return { value: parsed }
}

function parseOptionalDate(value: unknown, label: string) {
  if (!value) return { value: null }
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return { value: null, error: `${label} is not a valid date.` }
  return { value: date }
}

export function parsePromoInput(data: Record<string, unknown>) {
  const code = normalizePromoCode(data.code)
  const discountType = String(data.discountType || "PERCENT").toUpperCase() as PromoDiscountType
  const scope = String(data.scope || "ALL").toUpperCase() as PromoScope
  const discountValue = Number(data.discountValue)
  const maxDiscount = parseOptionalPositiveInteger(data.maxDiscount, "Maximum discount")
  const minSubtotal = parseNonNegativeInteger(data.minSubtotal, "Minimum subtotal")
  const maxRedemptions = parseOptionalPositiveInteger(data.maxRedemptions, "Total use limit")
  const maxRedemptionsPerUser = parseOptionalPositiveInteger(data.maxRedemptionsPerUser || 1, "Per-customer limit")
  const startsAt = parseOptionalDate(data.startsAt, "Start date")
  const expiresAt = parseOptionalDate(data.expiresAt, "End date")

  const error = !isValidPromoCodeFormat(code)
    ? "Code must be 3–32 letters, numbers, dashes, or underscores."
    : !PROMO_DISCOUNT_TYPES.includes(discountType)
      ? "Choose a valid discount type."
      : !PROMO_SCOPES.includes(scope)
        ? "Choose a valid promo scope."
        : !Number.isInteger(discountValue) || discountValue <= 0
          ? "Discount value must be a positive whole number."
          : discountType === "PERCENT" && discountValue > 100
            ? "Percentage discounts cannot exceed 100%."
            : maxDiscount.error || minSubtotal.error || maxRedemptions.error || maxRedemptionsPerUser.error || startsAt.error || expiresAt.error
              || (startsAt.value && expiresAt.value && expiresAt.value <= startsAt.value ? "End date must be after the start date." : "")

  return {
    error,
    values: {
      code,
      description: cleanString(data.description, 500) || null,
      discountType,
      discountValue,
      maxDiscount: discountType === "PERCENT" ? maxDiscount.value : null,
      minSubtotal: minSubtotal.value,
      scope,
      active: data.active !== false,
      startsAt: startsAt.value,
      expiresAt: expiresAt.value,
      maxRedemptions: maxRedemptions.value,
      maxRedemptionsPerUser: maxRedemptionsPerUser.value || 1,
    },
  }
}
