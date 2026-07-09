import { parseDateKey, parseScheduleDays, parseTimeLabel, scheduleOfferings } from "@/lib/class-schedule"
import { cleanString, safeHeaderValue } from "@/lib/server-security"

export const classHoldStatuses = ["ACTIVE", "PAUSED", "CANCELLED"] as const

export interface ValidatedClassHold {
  studentName: string
  studentEmail: string | null
  workshopId: string
  timeLabel: string
  seats: number
  weekdays: number[]
  startDate: Date
  endDate: Date | null
  notes: string | null
  status?: string
}

export function parseHoldWeekdays(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
}

export function validateClassHoldPayload(data: Record<string, unknown>): { data: ValidatedClassHold } | { error: string; status: number } {
  const studentName = cleanString(data.studentName, 160)
  const studentEmail = safeHeaderValue(data.studentEmail, 254)
  const notes = cleanString(data.notes, 1000)

  if (!studentName) {
    return { error: "Student name is required", status: 400 }
  }

  const workshopId = cleanString(data.workshopId, 80)
  const workshop = scheduleOfferings.find((item) => item.id === workshopId)
  if (!workshop || workshop.category === "residency") {
    return { error: "Choose a valid class workshop", status: 400 }
  }

  const seats = Number(data.seats || 1)
  const maxParticipants = workshop.maxParticipants ?? 8
  if (!Number.isInteger(seats) || seats < 1 || seats > maxParticipants) {
    return { error: `Seats must be between 1 and ${maxParticipants}`, status: 400 }
  }

  const allowCustomTime = data.allowCustomTime === true
  const timeLabel = cleanString(data.timeLabel, 80)
  const validTimes = (workshop.schedule || []).map(parseTimeLabel)
  if (!timeLabel || (validTimes.length > 0 && !validTimes.includes(timeLabel) && !allowCustomTime)) {
    return { error: "Choose a valid class time", status: 400 }
  }

  const validWeekdays = new Set((workshop.schedule || []).flatMap(parseScheduleDays))
  const requestedWeekdays = parseHoldWeekdays(data.weekdays)
  const weekdays = validWeekdays.size > 0 && !allowCustomTime
    ? requestedWeekdays.filter((day) => validWeekdays.has(day))
    : requestedWeekdays
  if (weekdays.length === 0) {
    return { error: "Choose at least one valid class day", status: 400 }
  }

  const startDate = parseDateKey(cleanString(data.startDate, 20))
  const endDate = data.endDate ? parseDateKey(cleanString(data.endDate, 20)) : null
  if (Number.isNaN(startDate.getTime()) || (endDate && Number.isNaN(endDate.getTime()))) {
    return { error: "Choose valid start and end dates", status: 400 }
  }
  if (endDate && endDate < startDate) {
    return { error: "End date must be after start date", status: 400 }
  }

  const status = typeof data.status === "string" ? data.status : undefined
  if (status && !classHoldStatuses.includes(status as (typeof classHoldStatuses)[number])) {
    return { error: "Invalid hold status", status: 400 }
  }

  return {
    data: {
      studentName,
      studentEmail: studentEmail || null,
      workshopId: workshop.id,
      timeLabel,
      seats,
      weekdays,
      startDate,
      endDate,
      notes: notes || null,
      status,
    },
  }
}
