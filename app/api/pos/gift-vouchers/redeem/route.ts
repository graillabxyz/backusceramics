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

  try {
    const voucher = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`gift:${lookup}`})::bigint)`
      const current = await findGiftVoucher(tx, lookup)
      if (!current) throw new Error("Gift voucher not found.")
      if (current.type !== "CLASS") throw new Error("Cash vouchers are applied to a POS sale instead.")
      if (current.status !== "ACTIVE" || current.remainingClassDays < 1) throw new Error("This class voucher has no remaining days.")
      const remainingClassDays = current.remainingClassDays - 1
      const updated = await tx.giftVoucher.update({
        where: { id: current.id },
        data: { remainingClassDays, status: remainingClassDays === 0 ? "REDEEMED" : "ACTIVE", redeemedAt: remainingClassDays === 0 ? new Date() : null },
      })
      await tx.giftVoucherRedemption.create({
        data: { voucherId: current.id, operatorId: operator.id, type: "CLASS_DAY", classDays: 1, participants: current.participants },
      })
      return updated
    })
    return NextResponse.json({ voucher: serializeGiftVoucher(voucher), message: `Redeemed one class day for ${voucher.participants} ${voucher.participants === 1 ? "person" : "people"}.` })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Voucher could not be redeemed." }, { status: 409 })
  }
}
