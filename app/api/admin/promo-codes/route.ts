import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManagePromotions } from "@/lib/permissions"
import { parsePromoInput } from "@/lib/promo-code-admin"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"

const MAX_PROMO_ADMIN_BODY_BYTES = 16 * 1024

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

  const parsed = parsePromoInput(data as Record<string, unknown>)
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 })
  try {
    const promoCode = await prisma.promoCode.update({ where: { id }, data: parsed.values })
    return NextResponse.json({ promoCode })
  } catch (error) {
    console.error("Could not update promo code", { error, promoCodeId: id })
    return NextResponse.json({ error: "That promo code already exists or could not be updated." }, { status: 409 })
  }
}

export async function DELETE(req: NextRequest) {
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

  try {
    const promoCode = await prisma.promoCode.findUnique({
      where: { id },
      select: { _count: { select: { redemptions: true } } },
    })
    if (!promoCode) return NextResponse.json({ error: "Promo code was not found." }, { status: 404 })
    if (promoCode._count.redemptions > 0) {
      return NextResponse.json(
        { error: "This promo code has checkout or redemption history and cannot be deleted. Pause it instead." },
        { status: 409 },
      )
    }
    await prisma.promoCode.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Could not delete promo code", { error, promoCodeId: id })
    return NextResponse.json(
      { error: "This promo code has checkout or redemption history and cannot be deleted. Pause it instead." },
      { status: 409 },
    )
  }
}
