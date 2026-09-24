import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { previewPromoCode, PromoCodeError } from "@/lib/promo-codes"
import { getPosOperatorFromRequest } from "@/lib/pos-operator-session"
import { isRequestBodyTooLarge } from "@/lib/server-security"

const MAX_POS_PROMO_BODY_BYTES = 8 * 1024

async function requirePosAccess(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return { error: "Unauthorized", status: 401 as const }
  }
  const operator = await getPosOperatorFromRequest(req)
  if (!operator) {
    return { error: "Unlock the POS with a cashier PIN to use promotions.", status: 423 as const }
  }
  return { session, operator }
}

export async function GET(req: NextRequest) {
  const access = await requirePosAccess(req)
  if ("error" in access) {
    return NextResponse.json(
      { error: access.error, code: access.status === 423 ? "POS_PIN_LOCKED" : undefined },
      { status: access.status },
    )
  }

  const now = new Date()
  const promoCodes = await prisma.promoCode.findMany({
    where: {
      active: true,
      posEnabled: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    select: {
      id: true,
      code: true,
      description: true,
      discountType: true,
      discountValue: true,
      maxDiscount: true,
      minSubtotal: true,
      scope: true,
      expiresAt: true,
    },
    orderBy: [{ createdAt: "desc" }],
  })

  return NextResponse.json({ promoCodes })
}

export async function POST(req: NextRequest) {
  const access = await requirePosAccess(req)
  if ("error" in access) {
    return NextResponse.json(
      { error: access.error, code: access.status === 423 ? "POS_PIN_LOCKED" : undefined },
      { status: access.status },
    )
  }
  if (isRequestBodyTooLarge(req, MAX_POS_PROMO_BODY_BYTES)) {
    return NextResponse.json({ error: "Promo request is too large." }, { status: 413 })
  }

  const data = await req.json().catch(() => null)
  const subtotal = Number(data?.subtotal)
  if (!data || typeof data !== "object" || !Number.isInteger(subtotal) || subtotal <= 0) {
    return NextResponse.json({ error: "Promo request is invalid." }, { status: 400 })
  }

  try {
    const promo = await previewPromoCode({
      code: String(data.code || ""),
      channel: "POS",
      subtotal,
    })
    return NextResponse.json({ promo })
  } catch (error) {
    const promoError = error instanceof PromoCodeError
    return NextResponse.json(
      {
        error: promoError ? error.message : "Promo code could not be checked right now.",
        code: promoError ? error.code : "PROMO_CHECK_FAILED",
      },
      { status: promoError ? 400 : 500 },
    )
  }
}
