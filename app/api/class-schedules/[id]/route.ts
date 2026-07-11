import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"
import { getScheduleOffering, parseDateKey } from "@/lib/class-schedule"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"

const scheduleStatuses = ["ACTIVE", "PAUSED", "CANCELLED"] as const
const scheduleCategories = ["weekly-class", "multi-day", "event"] as const
const MAX_CLASS_SCHEDULE_BODY_BYTES = 32 * 1024

function parseWeekdays(value: unknown) {
  if (!Array.isArray(value)) return null
  const weekdays = Array.from(new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
  return weekdays.length > 0 ? weekdays : null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isRequestBodyTooLarge(req, MAX_CLASS_SCHEDULE_BODY_BYTES)) {
    return NextResponse.json({ error: "Schedule request is too large" }, { status: 413 })
  }

  const existing = await prisma.classSchedule.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Schedule not found" }, { status: 404 })

  const data = await req.json().catch(() => null)
  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "Schedule request is not valid JSON" }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if ("status" in data) {
    if (!scheduleStatuses.includes(data.status)) return NextResponse.json({ error: "Invalid schedule status" }, { status: 400 })
    update.status = data.status
  }

  if ("offeringId" in data) {
    const offering = getScheduleOffering(data.offeringId)
    if (!offering) return NextResponse.json({ error: "Choose a valid class or event" }, { status: 400 })
    update.offeringId = offering.id
  }

  if ("category" in data) {
    if (!scheduleCategories.includes(data.category)) return NextResponse.json({ error: "Choose a valid schedule type" }, { status: 400 })
    update.category = data.category
  }

  if ("title" in data) {
    const title = cleanString(data.title, 160)
    if (!title) return NextResponse.json({ error: "Add a display title" }, { status: 400 })
    update.title = title
  }

  if ("timeLabel" in data) {
    const timeLabel = cleanString(data.timeLabel, 80)
    if (!timeLabel) return NextResponse.json({ error: "Add a class time" }, { status: 400 })
    update.timeLabel = timeLabel
  }

  if ("maxParticipants" in data) {
    const maxParticipants = Number(data.maxParticipants)
    if (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 50) {
      return NextResponse.json({ error: "Capacity must be between 1 and 50" }, { status: 400 })
    }
    update.maxParticipants = maxParticipants
  }

  const nextStartDate = "startDate" in data ? parseDateKey(data.startDate) : existing.startDate
  const nextEndDate = "endDate" in data ? (data.endDate ? parseDateKey(data.endDate) : null) : existing.endDate
  if (Number.isNaN(nextStartDate.getTime()) || (nextEndDate && Number.isNaN(nextEndDate.getTime()))) {
    return NextResponse.json({ error: "Choose valid schedule dates" }, { status: 400 })
  }
  if (nextEndDate && nextEndDate < nextStartDate) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 })
  }
  if ("startDate" in data) update.startDate = nextStartDate
  if ("endDate" in data) update.endDate = nextEndDate

  if ("weekdays" in data) {
    const weekdays = parseWeekdays(data.weekdays)
    const nextCategory = String(update.category || existing.category)
    if (nextCategory === "weekly-class" && !weekdays) {
      return NextResponse.json({ error: "Choose at least one repeat day" }, { status: 400 })
    }
    update.weekdays = weekdays ? JSON.stringify(weekdays) : null
  }

  if ("notes" in data) update.notes = cleanString(data.notes, 1000) || null

  const schedule = await prisma.classSchedule.update({
    where: { id },
    data: update,
  })

  return NextResponse.json(schedule)
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

  const existing = await prisma.classSchedule.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: "Schedule not found" }, { status: 404 })

  const schedule = await prisma.classSchedule.update({ where: { id }, data: { status: "CANCELLED" } })
  return NextResponse.json(schedule)
}
