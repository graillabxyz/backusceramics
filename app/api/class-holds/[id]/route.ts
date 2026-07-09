import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { classHoldStatuses, validateClassHoldPayload } from "@/lib/class-hold-validation"
import { isFullAdminRole } from "@/lib/permissions"
import { isRequestBodyTooLarge } from "@/lib/server-security"

const MAX_CLASS_HOLD_BODY_BYTES = 32 * 1024

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isRequestBodyTooLarge(req, MAX_CLASS_HOLD_BODY_BYTES)) {
    return NextResponse.json({ error: "Hold request is too large" }, { status: 413 })
  }

  const data = await req.json()
  const keys = Object.keys(data)

  if (keys.length === 1 && keys[0] === "status") {
    if (!classHoldStatuses.includes(data.status)) {
      return NextResponse.json({ error: "Invalid hold status" }, { status: 400 })
    }

    const hold = await prisma.classHold.update({
      where: { id },
      data: {
        status: data.status,
      },
    })

    return NextResponse.json(hold)
  }

  const validation = validateClassHoldPayload(data)
  if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: validation.status })
  const holdData = validation.data

  const hold = await prisma.classHold.update({
    where: { id },
    data: {
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

  return NextResponse.json(hold)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await prisma.classHold.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
