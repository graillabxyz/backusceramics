import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { previewPromoCode, PromoCodeError, PROMO_CHANNELS, type PromoChannel } from "@/lib/promo-codes"
import { checkRateLimit, isRequestBodyTooLarge, rateLimitHeaders } from "@/lib/server-security"

const MAX_PROMO_BODY_BYTES = 8 * 1024

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, { key: "promo-validate", limit: 20, windowMs: 10 * 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many promo code attempts. Please wait a few minutes." },
      { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) },
    )
  }
  if (isRequestBodyTooLarge(req, MAX_PROMO_BODY_BYTES)) {
    return NextResponse.json({ error: "Promo request is too large." }, { status: 413 })
  }

  const data = await req.json().catch(() => null)
  const channel = String(data?.channel || "").toUpperCase() as PromoChannel
  const subtotal = Number(data?.subtotal)
  if (!PROMO_CHANNELS.includes(channel) || !Number.isInteger(subtotal) || subtotal <= 0) {
    return NextResponse.json({ error: "Promo request is invalid." }, { status: 400 })
  }

  const session = await auth().catch(() => null)
  try {
    const promo = await previewPromoCode({
      code: data?.code,
      channel,
      subtotal,
      userId: session?.user.id,
      customerEmail: session?.user.email,
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
