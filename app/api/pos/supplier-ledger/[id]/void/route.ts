import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { POS_PIN_LOCK_SECONDS } from "@/lib/pos-pin"
import { getPosOperatorFromRequest, setPosOperatorCookie } from "@/lib/pos-operator-session"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const operator = await getPosOperatorFromRequest(req)
  if (!operator) return NextResponse.json({ error: "Unlock the POS before voiding supplier activity.", code: "POS_PIN_LOCKED" }, { status: 423 })
  if (isRequestBodyTooLarge(req, 8 * 1024)) return NextResponse.json({ error: "Void request is too large." }, { status: 413 })

  const { id } = await context.params
  const data = await req.json().catch(() => ({}))
  const reason = typeof data.reason === "string" ? cleanString(data.reason, 500) : ""
  if (reason.length < 3) return NextResponse.json({ error: "Add a reason for voiding this entry." }, { status: 400 })

  const updated = await prisma.supplierLedgerEntry.updateMany({
    where: { id, voidedAt: null },
    data: { voidedAt: new Date(), voidedById: operator.id, voidReason: reason },
  })
  if (updated.count !== 1) return NextResponse.json({ error: "This entry was already voided or no longer exists." }, { status: 409 })

  const response = NextResponse.json({ ok: true })
  setPosOperatorCookie(response, operator.id, POS_PIN_LOCK_SECONDS)
  return response
}
