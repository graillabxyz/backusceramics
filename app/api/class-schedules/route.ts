import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getScheduleOffering, parseDateKey } from "@/lib/class-schedule"
import { isFullAdminRole } from "@/lib/permissions"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"

const MAX_CLASS_SCHEDULE_BODY_BYTES = 32 * 1024

function parseWeekdays(value: unknown) {
  if (!Array.isArray(value)) return null
  const weekdays = value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  return weekdays.length > 0 ? weekdays : null
}

export async function GET() {
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const schedules = await prisma.classSchedule.findMany({
    orderBy: [{ status: "asc" }, { startDate: "asc" }],
  })

  return NextResponse.json(schedules)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isRequestBodyTooLarge(req, MAX_CLASS_SCHEDULE_BODY_BYTES)) {
    return NextResponse.json({ error: "Schedule request is too large" }, { status: 413 })
  }

  const data = await req.json()
  const offering = getScheduleOffering(data.offeringId)
  if (!offering) {
    return NextResponse.json({ error: "Choose a valid class or event" }, { status: 400 })
  }

  const startDate = parseDateKey(data.startDate)
  const endDate = data.endDate ? parseDateKey(data.endDate) : null
  if (Number.isNaN(startDate.getTime()) || (endDate && Number.isNaN(endDate.getTime()))) {
    return NextResponse.json({ error: "Choose valid schedule dates" }, { status: 400 })
  }
  if (endDate && endDate < startDate) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 })
  }

  const maxParticipants = Number(data.maxParticipants || offering.maxParticipants || 8)
  if (!Number.isInteger(maxParticipants) || maxParticipants < 1) {
    return NextResponse.json({ error: "Capacity is invalid" }, { status: 400 })
  }

  const weekdays = parseWeekdays(data.weekdays)
  const schedule = await prisma.classSchedule.create({
    data: {
      createdBy: session.user.id,
      offeringId: offering.id,
      title: cleanString(data.title, 160) || offering.title,
      category: cleanString(data.category, 80) || (offering.id.includes("event") || offering.id === "private-atelier" ? "event" : "class"),
      timeLabel: cleanString(data.timeLabel, 80),
      startDate,
      endDate,
      weekdays: weekdays ? JSON.stringify(weekdays) : null,
      maxParticipants,
      notes: cleanString(data.notes, 1000) || null,
    },
  })

  return NextResponse.json(schedule)
}
