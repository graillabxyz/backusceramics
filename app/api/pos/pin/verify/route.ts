import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { canUsePos } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { isValidPosPin, POS_PIN_LOCK_SECONDS, verifyPosPin } from "@/lib/pos-pin"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { pin } = await req.json().catch(() => ({}))
  if (!isValidPosPin(pin)) {
    return NextResponse.json(
      { error: "Enter your 6 digit POS PIN.", code: "POS_PIN_INVALID_FORMAT" },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, posPinHash: true },
  })

  if (!user?.posPinHash) {
    return NextResponse.json(
      {
        error: "A POS PIN must be set before using the register.",
        code: "POS_PIN_REQUIRED",
      },
      { status: 403 }
    )
  }

  const verified = await verifyPosPin(pin, user.posPinHash)
  if (!verified) {
    return NextResponse.json(
      { error: "That PIN did not match this POS user.", code: "POS_PIN_INVALID" },
      { status: 401 }
    )
  }

  return NextResponse.json({
    ok: true,
    unlockedAt: new Date().toISOString(),
    lockAfterSeconds: POS_PIN_LOCK_SECONDS,
  })
}
