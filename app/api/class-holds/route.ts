import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"
import { validateClassHoldPayload } from "@/lib/class-hold-validation"
import { validateClassHoldCapacity } from "@/lib/class-hold-capacity"
import { isRequestBodyTooLarge } from "@/lib/server-security"

const MAX_CLASS_HOLD_BODY_BYTES = 32 * 1024

export async function GET() {
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const holds = await prisma.classHold.findMany({
    orderBy: [{ status: "asc" }, { startDate: "asc" }],
  })

  return NextResponse.json(holds)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isRequestBodyTooLarge(req, MAX_CLASS_HOLD_BODY_BYTES)) {
    return NextResponse.json({ error: "Hold request is too large" }, { status: 413 })
  }

  const data = await req.json()
  const validation = validateClassHoldPayload(data)
  if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: validation.status })
  const holdData = validation.data
  const result = await prisma.$transaction(async (tx) => {
    const capacityError = await validateClassHoldCapacity(holdData, { db: tx, lockSeatPools: true })
    if (capacityError) return { capacityError, hold: null }

    const hold = await tx.classHold.create({
      data: {
        createdBy: session.user.id,
        studentName: holdData.studentName,
        studentEmail: holdData.studentEmail,
        workshopId: holdData.workshopId,
        timeLabel: holdData.timeLabel,
        seats: holdData.seats,
        weekdays: JSON.stringify(holdData.weekdays),
        startDate: holdData.startDate,
        endDate: holdData.endDate,
        notes: holdData.notes,
        ...(holdData.status ? { status: holdData.status } : {}),
      },
    })
    return { capacityError: null, hold }
  }, { timeout: 10_000 })

  if (result.capacityError) {
    return NextResponse.json({ error: result.capacityError.error }, { status: result.capacityError.status })
  }

  return NextResponse.json(result.hold)
}
