import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { CASH_OUT_FUNDING_SOURCES, summarizeCashOuts, type CashOutFundingSource } from "@/lib/pos-cash-outs"
import { POS_PIN_LOCK_SECONDS } from "@/lib/pos-pin"
import { getPosOperatorFromRequest, setPosOperatorCookie } from "@/lib/pos-operator-session"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"

const MAX_AMOUNT = 2_000_000_000
const MAX_BODY_BYTES = 8 * 1024

function isValidBusinessDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

async function authorize(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) return { error: "Unauthorized", status: 401 as const }
  const operator = await getPosOperatorFromRequest(req)
  if (!operator) return { error: "Unlock the POS with your cashier PIN to use cash out.", status: 423 as const }
  return { operator }
}

const personSelect = { id: true, name: true, email: true } as const
const entryInclude = {
  createdBy: { select: personSelect },
  staffMember: { select: personSelect },
  reimbursedBy: { select: personSelect },
  voidedBy: { select: personSelect },
} as const

export async function GET(req: NextRequest) {
  const access = await authorize(req)
  if ("error" in access) return NextResponse.json({ error: access.error, code: access.status === 423 ? "POS_PIN_LOCKED" : undefined }, { status: access.status })

  const entries = await prisma.posCashOut.findMany({
    orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
    take: 300,
    include: entryInclude,
  })
  const active = entries.filter((entry) => !entry.voidedAt)
  const response = NextResponse.json({
    entries,
    summary: {
      openStaffClaims: active.filter((entry) => entry.fundingSource === "STAFF" && !entry.reimbursedAt).length,
      ...summarizeCashOuts(entries, "0000-01-01", "9999-12-31"),
    },
  })
  setPosOperatorCookie(response, access.operator.id, POS_PIN_LOCK_SECONDS)
  return response
}

export async function POST(req: NextRequest) {
  const access = await authorize(req)
  if ("error" in access) return NextResponse.json({ error: access.error, code: access.status === 423 ? "POS_PIN_LOCKED" : undefined }, { status: access.status })
  if (isRequestBodyTooLarge(req, MAX_BODY_BYTES)) return NextResponse.json({ error: "Cash out entry is too large." }, { status: 413 })

  const data = await req.json().catch(() => ({}))
  const fundingSource = typeof data.fundingSource === "string" ? data.fundingSource.toUpperCase() as CashOutFundingSource : ""
  const amount = Number(data.amount)
  const description = typeof data.description === "string" ? cleanString(data.description, 500) : ""
  const businessDate = typeof data.businessDate === "string" ? data.businessDate : ""

  if (!CASH_OUT_FUNDING_SOURCES.includes(fundingSource as CashOutFundingSource)) return NextResponse.json({ error: "Choose register cash or staff paid personally." }, { status: 400 })
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_AMOUNT) return NextResponse.json({ error: "Enter a whole IDR amount greater than zero." }, { status: 400 })
  if (description.length < 3) return NextResponse.json({ error: "Add a short description of what the money was used for." }, { status: 400 })
  if (!isValidBusinessDate(businessDate)) return NextResponse.json({ error: "Choose a valid accounting date." }, { status: 400 })

  try {
    const entry = await prisma.posCashOut.create({
      data: {
        fundingSource,
        amount,
        description,
        businessDate,
        createdById: access.operator.id,
        staffMemberId: fundingSource === "STAFF" ? access.operator.id : null,
      },
      include: entryInclude,
    })
    const response = NextResponse.json(entry, { status: 201 })
    setPosOperatorCookie(response, access.operator.id, POS_PIN_LOCK_SECONDS)
    return response
  } catch (error) {
    console.error("Could not record POS cash out", { error, operatorId: access.operator.id, fundingSource, businessDate })
    return NextResponse.json({ error: "Could not record this cash out. Please try again." }, { status: 500 })
  }
}
