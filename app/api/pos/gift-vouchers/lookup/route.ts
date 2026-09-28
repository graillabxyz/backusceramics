import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { getPosOperatorFromRequest } from "@/lib/pos-operator-session"
import { normalizeGiftVoucherLookup } from "@/lib/gift-vouchers"
import { findGiftVoucher, serializeGiftVoucher } from "@/lib/gift-voucher-service"
import { isRequestBodyTooLarge } from "@/lib/server-security"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const operator = await getPosOperatorFromRequest(req)
  if (!operator) return NextResponse.json({ error: "Unlock the POS with a cashier PIN.", code: "POS_PIN_LOCKED" }, { status: 423 })
  if (isRequestBodyTooLarge(req, 8 * 1024)) return NextResponse.json({ error: "Voucher request is too large." }, { status: 413 })
  const data = await req.json().catch(() => null)
  const lookup = normalizeGiftVoucherLookup(data?.lookup)
  if (!lookup) return NextResponse.json({ error: "Scan a QR code or enter a voucher code." }, { status: 400 })
  const voucher = await findGiftVoucher(prisma, lookup)
  if (!voucher) return NextResponse.json({ error: "Gift voucher not found." }, { status: 404 })
  return NextResponse.json({ voucher: serializeGiftVoucher(voucher) }, { headers: { "Cache-Control": "private, no-store" } })
}
