import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildGiftVoucherPdf } from "@/lib/gift-voucher-pdf"
import { getTrustedRequestOrigin } from "@/lib/request-origin"

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const voucher = await prisma.giftVoucher.findUnique({ where: { token } })
  if (!voucher || voucher.status === "PENDING_PAYMENT" || voucher.status === "CANCELLED") return NextResponse.json({ error: "Gift voucher is not available." }, { status: 404 })
  const pdf = await buildGiftVoucherPdf(voucher, getTrustedRequestOrigin(req))
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${voucher.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
