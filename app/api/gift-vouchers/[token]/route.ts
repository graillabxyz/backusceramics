import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, rateLimitHeaders } from "@/lib/server-security"
import { serializeGiftVoucher } from "@/lib/gift-voucher-service"
import { reconcileXenditGiftVoucherByToken } from "@/lib/xendit-sale-reconciliation"

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rateLimit = checkRateLimit(req, { key: "gift-voucher-public", limit: 60, windowMs: 10 * 60_000 })
  if (!rateLimit.allowed) return NextResponse.json({ error: "Too many voucher checks." }, { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) })
  const { token } = await params
  let voucher = await prisma.giftVoucher.findUnique({ where: { token } })
  if (!voucher) return NextResponse.json({ error: "Gift voucher not found." }, { status: 404 })
  const voucherId = voucher.id
  if (voucher.status === "PENDING_PAYMENT" && voucher.paymentSessionId) {
    try {
      await reconcileXenditGiftVoucherByToken(token)
      voucher = await prisma.giftVoucher.findUnique({ where: { token } })
    } catch (error) {
      console.error("Could not reconcile gift voucher payment", { error, voucherId })
    }
  }
  if (!voucher) return NextResponse.json({ error: "Gift voucher not found." }, { status: 404 })
  return NextResponse.json({ voucher: serializeGiftVoucher(voucher) }, { headers: { "Cache-Control": "no-store" } })
}
