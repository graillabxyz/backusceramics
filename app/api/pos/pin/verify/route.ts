import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canUsePos } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { isValidPosPin, POS_PIN_LOCK_SECONDS, verifyPosPin } from "@/lib/pos-pin"
import { clearPosOperatorCookie, getPosOperatorFromRequest, setPosOperatorCookie } from "@/lib/pos-operator-session"
import { checkRateLimit, isRequestBodyTooLarge, rateLimitHeaders } from "@/lib/server-security"

const POS_PIN_ROLES = ["OWNER", "ADMIN", "MANAGER", "POS_OPERATOR"]

function unlockedResponse(operator: { id: string; name: string | null; email: string; role: string }) {
  const response = NextResponse.json({
    ok: true,
    unlockedAt: new Date().toISOString(),
    lockAfterSeconds: POS_PIN_LOCK_SECONDS,
    operator,
  })
  setPosOperatorCookie(response, operator.id, POS_PIN_LOCK_SECONDS)
  return response
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const operator = await getPosOperatorFromRequest(req)
  if (!operator) {
    return NextResponse.json(
      { error: "Enter your cashier PIN to unlock the POS.", code: "POS_PIN_LOCKED" },
      { status: 423 }
    )
  }

  return unlockedResponse(operator)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isRequestBodyTooLarge(req, 4 * 1024)) {
    return NextResponse.json({ error: "PIN request is too large" }, { status: 413 })
  }

  const rateLimit = checkRateLimit(req, { key: "pos-pin", limit: 10, windowMs: 5 * 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many PIN attempts. Wait a few minutes before trying again.", code: "POS_PIN_RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) }
    )
  }

  const { pin } = await req.json().catch(() => ({}))
  if (!isValidPosPin(pin)) {
    return NextResponse.json(
      { error: "Enter your 6 digit POS PIN.", code: "POS_PIN_INVALID_FORMAT" },
      { status: 400 }
    )
  }

  const posUsers = await prisma.user.findMany({
    where: {
      role: { in: POS_PIN_ROLES },
      posPinHash: { not: null },
    },
    orderBy: [{ posPinSetAt: "desc" }, { name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      posPinHash: true,
    },
  })

  if (posUsers.length === 0) {
    return NextResponse.json(
      {
        error: "A POS PIN must be set before using the register.",
        code: "POS_PIN_REQUIRED",
      },
      { status: 403 }
    )
  }

  let operator: (typeof posUsers)[number] | null = null
  for (const posUser of posUsers) {
    if (await verifyPosPin(pin, posUser.posPinHash)) {
      operator = posUser
      break
    }
  }

  if (!operator) {
    return NextResponse.json(
      { error: "That PIN did not match this POS user.", code: "POS_PIN_INVALID" },
      { status: 401 }
    )
  }

  return unlockedResponse({
    id: operator.id,
    name: operator.name,
    email: operator.email,
    role: operator.role,
  })
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  clearPosOperatorCookie(response)
  return response
}
