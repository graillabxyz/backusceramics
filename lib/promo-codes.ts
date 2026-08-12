import type { Prisma, PromoCode } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export const PROMO_CHANNELS = ["SHOP", "CLASSES"] as const
export const PROMO_SCOPES = ["ALL", ...PROMO_CHANNELS] as const
export const PROMO_DISCOUNT_TYPES = ["PERCENT", "FIXED"] as const
export const MINIMUM_DISCOUNTED_PAYMENT_IDR = 10_000

export type PromoChannel = (typeof PROMO_CHANNELS)[number]
export type PromoScope = (typeof PROMO_SCOPES)[number]
export type PromoDiscountType = (typeof PROMO_DISCOUNT_TYPES)[number]

type PromoDb = Pick<Prisma.TransactionClient, "promoCode" | "promoRedemption" | "$queryRaw">

export class PromoCodeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = "PromoCodeError"
  }
}

export function normalizePromoCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, 32)
}

export function isValidPromoCodeFormat(code: string) {
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)
}

export function calculatePromoDiscount(
  promo: Pick<PromoCode, "discountType" | "discountValue" | "maxDiscount">,
  subtotal: number,
) {
  if (!Number.isInteger(subtotal) || subtotal <= MINIMUM_DISCOUNTED_PAYMENT_IDR) return 0

  const rawDiscount = promo.discountType === "PERCENT"
    ? Math.floor((subtotal * promo.discountValue) / 100)
    : promo.discountValue
  const cappedDiscount = promo.maxDiscount
    ? Math.min(rawDiscount, promo.maxDiscount)
    : rawDiscount

  return Math.max(Math.min(cappedDiscount, subtotal - MINIMUM_DISCOUNTED_PAYMENT_IDR), 0)
}

function activeRedemptionWhere(now: Date) {
  return {
    OR: [
      { status: "APPLIED" },
      { status: "PENDING", expiresAt: { gt: now } },
    ],
  } satisfies Prisma.PromoRedemptionWhereInput
}

function validatePromoState(promo: PromoCode | null, channel: PromoChannel, subtotal: number, now: Date) {
  if (!promo || !promo.active) {
    throw new PromoCodeError("This promo code is not available.", "PROMO_NOT_AVAILABLE")
  }
  if (promo.scope !== "ALL" && promo.scope !== channel) {
    throw new PromoCodeError(
      promo.scope === "SHOP" ? "This code is only for shop purchases." : "This code is only for class bookings.",
      "PROMO_WRONG_SCOPE",
    )
  }
  if (promo.startsAt && promo.startsAt > now) {
    throw new PromoCodeError("This promo code is not active yet.", "PROMO_NOT_STARTED")
  }
  if (promo.expiresAt && promo.expiresAt <= now) {
    throw new PromoCodeError("This promo code has expired.", "PROMO_EXPIRED")
  }
  if (subtotal < promo.minSubtotal) {
    throw new PromoCodeError(
      `This promo code requires a minimum subtotal of Rp ${promo.minSubtotal.toLocaleString("id-ID")}.`,
      "PROMO_MINIMUM_NOT_MET",
    )
  }

  const discountAmount = calculatePromoDiscount(promo, subtotal)
  if (discountAmount <= 0) {
    throw new PromoCodeError("This promo code cannot be applied to this total.", "PROMO_NO_DISCOUNT")
  }
  return discountAmount
}

async function assertRedemptionLimits({
  db,
  promo,
  userId,
  customerEmail,
  now,
}: {
  db: Pick<PromoDb, "promoRedemption">
  promo: PromoCode
  userId?: string | null
  customerEmail?: string | null
  now: Date
}) {
  const activeWhere = activeRedemptionWhere(now)
  if (promo.maxRedemptions) {
    const totalUsed = await db.promoRedemption.count({
      where: { promoCodeId: promo.id, ...activeWhere },
    })
    if (totalUsed >= promo.maxRedemptions) {
      throw new PromoCodeError("This promo code has reached its usage limit.", "PROMO_LIMIT_REACHED")
    }
  }

  const normalizedEmail = customerEmail?.trim().toLowerCase() || null
  const customerIdentity = [
    ...(userId ? [{ userId }] : []),
    ...(normalizedEmail ? [{ customerEmail: normalizedEmail }] : []),
  ]
  if (customerIdentity.length > 0) {
    const customerUses = await db.promoRedemption.count({
      where: {
        promoCodeId: promo.id,
        ...activeWhere,
        OR: customerIdentity,
      },
    })
    if (customerUses >= promo.maxRedemptionsPerUser) {
      throw new PromoCodeError("You have already used this promo code.", "PROMO_CUSTOMER_LIMIT_REACHED")
    }
  }
}

export async function previewPromoCode({
  code,
  channel,
  subtotal,
  userId,
  customerEmail,
}: {
  code: string
  channel: PromoChannel
  subtotal: number
  userId?: string | null
  customerEmail?: string | null
}) {
  const normalizedCode = normalizePromoCode(code)
  if (!isValidPromoCodeFormat(normalizedCode)) {
    throw new PromoCodeError("Enter a valid promo code.", "PROMO_INVALID")
  }
  const now = new Date()
  const promo = await prisma.promoCode.findUnique({ where: { code: normalizedCode } })
  const discountAmount = validatePromoState(promo, channel, subtotal, now)
  await assertRedemptionLimits({ db: prisma, promo: promo!, userId, customerEmail, now })

  return {
    code: normalizedCode,
    discountAmount,
    discountedSubtotal: subtotal - discountAmount,
    description: promo?.description || null,
    discountType: promo!.discountType as PromoDiscountType,
    discountValue: promo!.discountValue,
  }
}

export async function reservePromoCode({
  db,
  code,
  channel,
  subtotal,
  userId,
  customerEmail,
  paymentReference,
  expiresAt,
}: {
  db: PromoDb
  code: string
  channel: PromoChannel
  subtotal: number
  userId?: string | null
  customerEmail?: string | null
  paymentReference: string
  expiresAt: Date
}) {
  const normalizedCode = normalizePromoCode(code)
  if (!normalizedCode) return null
  if (!isValidPromoCodeFormat(normalizedCode)) {
    throw new PromoCodeError("Enter a valid promo code.", "PROMO_INVALID")
  }

  await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`promo:${normalizedCode}`})::bigint)`
  const now = new Date()
  const promo = await db.promoCode.findUnique({ where: { code: normalizedCode } })
  const discountAmount = validatePromoState(promo, channel, subtotal, now)
  await assertRedemptionLimits({ db, promo: promo!, userId, customerEmail, now })

  const redemption = await db.promoRedemption.create({
    data: {
      promoCodeId: promo!.id,
      userId: userId || null,
      customerEmail: customerEmail?.trim().toLowerCase() || null,
      channel,
      subtotal,
      discountAmount,
      paymentReference,
      expiresAt,
    },
  })

  return { promo: promo!, redemption, discountAmount }
}

export async function setPromoPaymentSession(paymentReference: string, paymentSessionId: string) {
  await prisma.promoRedemption.updateMany({
    where: { paymentReference, status: "PENDING" },
    data: { paymentSessionId },
  })
}

export async function settlePromoRedemption({
  paymentReference,
  paymentSessionId,
  status,
}: {
  paymentReference?: string | null
  paymentSessionId?: string | null
  status: "APPLIED" | "CANCELLED"
}) {
  if (!paymentReference && !paymentSessionId) return 0
  const result = await prisma.promoRedemption.updateMany({
    where: {
      status: "PENDING",
      OR: [
        ...(paymentReference ? [{ paymentReference }] : []),
        ...(paymentSessionId ? [{ paymentSessionId }] : []),
      ],
    },
    data: status === "APPLIED"
      ? { status, appliedAt: new Date() }
      : { status, cancelledAt: new Date() },
  })
  return result.count
}
