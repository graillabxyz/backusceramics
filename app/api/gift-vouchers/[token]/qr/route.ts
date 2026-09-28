import { NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"
import { prisma } from "@/lib/prisma"
import { giftVoucherQrPayload } from "@/lib/gift-vouchers"
import { getTrustedRequestOrigin } from "@/lib/request-origin"

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const voucher = await prisma.giftVoucher.findUnique({ where: { token }, select: { token: true, status: true } })
  if (!voucher || voucher.status === "PENDING_PAYMENT" || voucher.status === "CANCELLED") return NextResponse.json({ error: "Gift voucher is not available." }, { status: 404 })
  const png = await QRCode.toBuffer(giftVoucherQrPayload(getTrustedRequestOrigin(req), voucher.token), { type: "png", width: 720, margin: 2, errorCorrectionLevel: "H" })
  return new NextResponse(new Blob([new Uint8Array(png)], { type: "image/png" }), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300", "Content-Disposition": `inline; filename="backus-gift-voucher-qr.png"` } })
}
