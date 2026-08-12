import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { CASH_OUT_REIMBURSEMENT_METHODS, type CashOutReimbursementMethod } from "@/lib/pos-cash-outs"
import { POS_PIN_LOCK_SECONDS } from "@/lib/pos-pin"
import { getPosOperatorFromRequest, setPosOperatorCookie } from "@/lib/pos-operator-session"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"

function isValidBusinessDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const operator = await getPosOperatorFromRequest(req)
  if (!operator) return NextResponse.json({ error: "Unlock the POS before recording a reimbursement.", code: "POS_PIN_LOCKED" }, { status: 423 })
  if (isRequestBodyTooLarge(req, 8 * 1024)) return NextResponse.json({ error: "Reimbursement entry is too large." }, { status: 413 })

  const { id } = await context.params
  const data = await req.json().catch(() => ({}))
  const method = typeof data.method === "string" ? data.method.toUpperCase() as CashOutReimbursementMethod : ""
  const businessDate = typeof data.businessDate === "string" ? data.businessDate : ""
  const note = typeof data.note === "string" ? cleanString(data.note, 500) : ""
  if (!CASH_OUT_REIMBURSEMENT_METHODS.includes(method as CashOutReimbursementMethod)) return NextResponse.json({ error: "Choose how the staff member was reimbursed." }, { status: 400 })
  if (!isValidBusinessDate(businessDate)) return NextResponse.json({ error: "Choose a valid reimbursement date." }, { status: 400 })

  const updated = await prisma.posCashOut.updateMany({
    where: { id, fundingSource: "STAFF", reimbursedAt: null, voidedAt: null },
    data: {
      reimbursedAt: new Date(),
      reimbursedBusinessDate: businessDate,
      reimbursementMethod: method,
      reimbursementNote: note || null,
      reimbursedById: operator.id,
    },
  })
  if (updated.count !== 1) return NextResponse.json({ error: "This staff purchase was already reimbursed, voided, or no longer exists." }, { status: 409 })

  const response = NextResponse.json({ ok: true })
  setPosOperatorCookie(response, operator.id, POS_PIN_LOCK_SECONDS)
  return response
}
