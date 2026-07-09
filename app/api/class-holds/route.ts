import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseDateKey, parseScheduleDays, parseTimeLabel, scheduleOfferings } from "@/lib/class-schedule"
import { isFullAdminRole } from "@/lib/permissions"
import { cleanString, isRequestBodyTooLarge, safeHeaderValue } from "@/lib/server-security"

const MAX_CLASS_HOLD_BODY_BYTES = 32 * 1024

function parseWeekdays(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
}

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
  const studentName = cleanString(data.studentName, 160)
  const studentEmail = safeHeaderValue(data.studentEmail, 254)
  const notes = cleanString(data.notes, 1000)

  if (!studentName) {
    return NextResponse.json({ error: "Student name is required" }, { status: 400 })
  }

  const workshop = scheduleOfferings.find((item) => item.id === data.workshopId)
  if (!workshop || workshop.category === "residency") {
    return NextResponse.json({ error: "Choose a valid class workshop" }, { status: 400 })
  }

  const seats = Number(data.seats || 1)
  const maxParticipants = workshop.maxParticipants ?? 8
  if (!Number.isInteger(seats) || seats < 1 || seats > maxParticipants) {
    return NextResponse.json({ error: `Seats must be between 1 and ${maxParticipants}` }, { status: 400 })
  }

  const allowCustomTime = data.allowCustomTime === true
  const validTimes = (workshop.schedule || []).map(parseTimeLabel)
  if (!data.timeLabel || (validTimes.length > 0 && !validTimes.includes(data.timeLabel) && !allowCustomTime)) {
    return NextResponse.json({ error: "Choose a valid class time" }, { status: 400 })
  }

  const validWeekdays = new Set((workshop.schedule || []).flatMap(parseScheduleDays))
  const requestedWeekdays = parseWeekdays(data.weekdays)
  const weekdays = validWeekdays.size > 0 && !allowCustomTime
    ? requestedWeekdays.filter((day) => validWeekdays.has(day))
    : requestedWeekdays
  if (weekdays.length === 0) {
    return NextResponse.json({ error: "Choose at least one valid class day" }, { status: 400 })
  }

  const startDate = parseDateKey(data.startDate)
  const endDate = data.endDate ? parseDateKey(data.endDate) : null
  if (Number.isNaN(startDate.getTime()) || (endDate && Number.isNaN(endDate.getTime()))) {
    return NextResponse.json({ error: "Choose valid start and end dates" }, { status: 400 })
  }
  if (endDate && endDate < startDate) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 })
  }

  const hold = await prisma.classHold.create({
    data: {
      createdBy: session.user.id,
      studentName,
      studentEmail: studentEmail || null,
      workshopId: workshop.id,
      timeLabel: cleanString(data.timeLabel, 80),
      seats,
      weekdays: JSON.stringify(weekdays),
      startDate,
      endDate,
      notes: notes || null,
    },
  })

  return NextResponse.json(hold)
}
