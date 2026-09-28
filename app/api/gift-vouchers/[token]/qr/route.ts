import { NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"
import { prisma } from "@/lib/prisma"
import { giftVoucherQrPayload } from "@/lib/gift-vouchers"
import { getTrustedRequestOrigin } from "@/lib/request-origin"
import { checkRateLimit, rateLimitHeaders } from "@/lib/server-security"

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rateLimit = checkRateLimit(req, { key: "gift-voucher-qr", limit: 60, windowMs: 10 * 60_000 })
  if (!rateLimit.allowed) return NextResponse.json({ error: "Too many QR requests." }, { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) })
  const { token } = await params
  const voucher = await prisma.giftVoucher.findUnique({ where: { token }, select: { token: true, status: true } })
  if (!voucher || voucher.status === "PENDING_PAYMENT" || voucher.status === "CANCELLED") return NextResponse.json({ error: "Gift voucher is not available." }, { status: 404 })
  const png = await QRCode.toBuffer(giftVoucherQrPayload(getTrustedRequestOrigin(req), voucher.token), { type: "png", width: 720, margin: 2, errorCorrectionLevel: "H" })
  return new NextResponse(new Blob([new Uint8Array(png)], { type: "image/png" }), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300", "Content-Disposition": `inline; filename="backus-gift-voucher-qr.png"` } })
}
