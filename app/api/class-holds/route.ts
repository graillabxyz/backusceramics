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

  try {
    const holds = await prisma.classHold.findMany({
      orderBy: [{ status: "asc" }, { startDate: "asc" }],
    })

    return NextResponse.json(holds)
  } catch (error) {
    console.error("Could not load class seat holds", { error })
    return NextResponse.json(
      { error: "Could not load seat holds. Please refresh and try again.", code: "CLASS_HOLDS_LOAD_FAILED" },
      { status: 503 }
    )
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isRequestBodyTooLarge(req, MAX_CLASS_HOLD_BODY_BYTES)) {
    return NextResponse.json({ error: "Hold request is too large" }, { status: 413 })
  }

  const data = await req.json().catch(() => null)
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Hold request is not valid JSON" }, { status: 400 })
  const validation = validateClassHoldPayload(data)
  if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: validation.status })
  const holdData = validation.data
  const requestId = crypto.randomUUID()
  let result
  try {
    result = await prisma.$transaction(async (tx) => {
      const capacityError = await validateClassHoldCapacity(holdData, { db: tx, lockSeatPools: true })
      if (capacityError) return { capacityError, hold: null }

      const creator = await tx.user.findFirst({
        where: {
          OR: [
            { id: session.user.id },
            { email: session.user.email },
          ],
        },
        select: { id: true },
      })
      const hold = await tx.classHold.create({
        data: {
          createdBy: creator?.id ?? null,
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
  } catch (error) {
    console.error("Could not create class seat hold", {
      error,
      requestId,
      actorEmail: session.user.email,
      workshopId: holdData.workshopId,
      timeLabel: holdData.timeLabel,
      seats: holdData.seats,
      startDate: holdData.startDate.toISOString(),
      endDate: holdData.endDate?.toISOString() ?? null,
    })
    return NextResponse.json(
      {
        error: "Could not save this seat hold. Please refresh and try again.",
        code: "CLASS_HOLD_SAVE_FAILED",
        requestId,
      },
      { status: 503 }
    )
  }

  if (result.capacityError) {
    return NextResponse.json(
      { error: result.capacityError.error, code: "CLASS_HOLD_CAPACITY_CONFLICT" },
      { status: result.capacityError.status }
    )
  }

  return NextResponse.json(result.hold)
}
