import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManagePromotions } from "@/lib/permissions"
import {
  isValidPromoCodeFormat,
  normalizePromoCode,
  PROMO_DISCOUNT_TYPES,
  PROMO_SCOPES,
  type PromoDiscountType,
  type PromoScope,
} from "@/lib/promo-codes"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"

const MAX_PROMO_ADMIN_BODY_BYTES = 16 * 1024

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

function parsePromoInput(data: Record<string, unknown>, requireCode = true) {
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

  const error = requireCode && !isValidPromoCodeFormat(code)
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
      ...(requireCode ? { code } : {}),
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

async function requirePromoAdmin() {
  const session = await auth()
  return session && canManagePromotions(session.user.role) ? session : null
}

export async function GET() {
  const session = await requirePromoAdmin()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const promoCodes = await prisma.promoCode.findMany({
    include: {
      redemptions: {
        select: { status: true, discountAmount: true, expiresAt: true },
      },
    },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  })
  const now = new Date()

  return NextResponse.json({
    promoCodes: promoCodes.map(({ redemptions, ...promo }) => ({
      ...promo,
      usage: {
        redeemed: redemptions.filter((item) => item.status === "APPLIED").length,
        reserved: redemptions.filter((item) => item.status === "PENDING" && item.expiresAt > now).length,
        discountGranted: redemptions
          .filter((item) => item.status === "APPLIED")
          .reduce((sum, item) => sum + item.discountAmount, 0),
      },
    })),
  })
}

export async function POST(req: NextRequest) {
  const session = await requirePromoAdmin()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (isRequestBodyTooLarge(req, MAX_PROMO_ADMIN_BODY_BYTES)) {
    return NextResponse.json({ error: "Promo code request is too large." }, { status: 413 })
  }

  const data = await req.json().catch(() => null)
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Promo request is invalid." }, { status: 400 })
  const parsed = parsePromoInput(data as Record<string, unknown>)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })

  try {
    const promoCode = await prisma.promoCode.create({
      data: {
        ...parsed.values,
        code: normalizePromoCode((data as Record<string, unknown>).code),
        createdById: session.user.id,
      },
    })
    return NextResponse.json({ promoCode }, { status: 201 })
  } catch (error) {
    console.error("Could not create promo code", { error })
    return NextResponse.json({ error: "That promo code already exists or could not be created." }, { status: 409 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requirePromoAdmin()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (isRequestBodyTooLarge(req, MAX_PROMO_ADMIN_BODY_BYTES)) {
    return NextResponse.json({ error: "Promo code request is too large." }, { status: 413 })
  }

  const data = await req.json().catch(() => null)
  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "Promo request is invalid." }, { status: 400 })
  }
  const id = cleanString(data?.id, 120)
  if (!id) return NextResponse.json({ error: "Promo code id is required." }, { status: 400 })

  if (data?.activeOnly === true) {
    const promoCode = await prisma.promoCode.update({ where: { id }, data: { active: Boolean(data.active) } })
    return NextResponse.json({ promoCode })
  }

  const parsed = parsePromoInput(data as Record<string, unknown>, false)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const promoCode = await prisma.promoCode.update({ where: { id }, data: parsed.values })
  return NextResponse.json({ promoCode })
}
