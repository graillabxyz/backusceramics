import { Workshop, workshops } from "@/lib/classes-data"

export const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
export const shortDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export interface CalendarSession {
  id: string
  scheduleId?: string
  workshop: Workshop
  date: Date
  dateKey: string
  timeLabel: string
  scheduleLabel: string
  sortHour: number
  maxParticipants?: number
  scheduleTitle?: string
  scheduleCategory?: string
  scheduleStartDate?: Date
  scheduleEndDate?: Date | null
  scheduleWeekdays?: number[] | null
}

export interface CalendarAvailability {
  sessionId: string
  scheduleId?: string
  workshopId: string
  title?: string
  category?: string
  dateKey: string
  timeLabel: string
  maxParticipants: number
  bookedSeats: number
  heldSeats: number
  availableSeats: number
}

export interface ClassScheduleLike {
  id: string
  offeringId: string
  title: string
  category: string
  timeLabel: string
  startDate: Date
  endDate: Date | null
  weekdays: string | null
  maxParticipants: number
}

export const eventOfferings: Workshop[] = [
  {
    id: "birthday-event",
    slug: "birthday-event",
    title: "Creative Birthday Atelier",
    subtitle: "Private Gatherings",
    price: 3000000,
    currency: "IDR",
    description: "A curated birthday ceramics workshop for children, families, or adults.",
    level: "Private Event",
    duration: "1.5 hours",
    features: ["Guided creative session", "Refreshments", "Glazing and firing"],
    available: true,
    category: "kids",
    maxParticipants: 8,
    image: "/birthday.jpeg",
  },
  {
    id: "private-atelier",
    slug: "private-atelier",
    title: "Private Atelier & Aperitivo",
    subtitle: "Curated Experience",
    price: 5500000,
    currency: "IDR",
    description: "A premium private studio workshop with aperitivo for friends or small teams.",
    level: "Private Event",
    duration: "2 hours",
    features: ["Premium guided workshop", "Curated grazing board", "Natural wines or mocktails"],
    available: true,
    category: "workshop",
    maxParticipants: 8,
    image: "/ambiance.JPG",
  },
]

export const scheduleOfferings = [...workshops.filter((workshop) => workshop.category !== "residency"), ...eventOfferings]

export function getScheduleOffering(offeringId: string) {
  return scheduleOfferings.find((offering) => offering.id === offeringId)
}

export function startOfWeek(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  const mondayOffset = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - mondayOffset)
  return copy
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function formatDateKey(date: Date) {
  return date.toLocaleDateString("en-CA")
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function parseTimeHour(timeLabel: string) {
  const match = timeLabel.match(/(\d{1,2})(?::(\d{2}))?/)
  return match ? Number(match[1]) : 12
}

export function parseStartTime(timeLabel: string) {
  const [startPart = timeLabel] = timeLabel.split("-")
  const normalizedStart = startPart.trim().toLowerCase()
  const normalizedLabel = timeLabel.toLowerCase()
  const match = normalizedStart.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (!match) return { hour: 12, minute: 0 }

  let hour = Number(match[1])
  const minute = Number(match[2] || 0)
  const explicitSuffix = match[3]
  const hasAfternoonContext = normalizedLabel.includes("pm")

  if (explicitSuffix === "pm" && hour < 12) hour += 12
  if (explicitSuffix === "am" && hour === 12) hour = 0
  if (!explicitSuffix && hasAfternoonContext && hour > 0 && hour < 8) hour += 12

  return { hour, minute }
}

export function getSessionStartDateTime(dateKey: string, timeLabel: string) {
  const { hour, minute } = parseStartTime(timeLabel)
  const paddedHour = hour.toString().padStart(2, "0")
  const paddedMinute = minute.toString().padStart(2, "0")
  return new Date(`${dateKey}T${paddedHour}:${paddedMinute}:00+08:00`)
}

export function hasSessionStartPassed(dateKey: string, timeLabel: string, now = new Date()) {
  return getSessionStartDateTime(dateKey, timeLabel).getTime() <= now.getTime()
}

export function parseScheduleDays(schedule: string) {
  const [dayPart = ""] = schedule.split(":")
  const normalized = dayPart.trim()

  if (normalized.includes("-")) {
    const [start, end] = normalized.split("-").map((item) => item.trim())
    const startIndex = dayNames.indexOf(start)
    const endIndex = dayNames.indexOf(end)

    if (startIndex >= 0 && endIndex >= 0) {
      const days = []
      for (let index = startIndex; index <= endIndex; index += 1) {
        days.push(index)
      }
      return days
    }
  }

  const singleDay = dayNames.indexOf(normalized)
  return singleDay >= 0 ? [singleDay] : []
}

export function parseWeekdays(value: string) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(Number) : []
  } catch {
    return []
  }
}

export function parseTimeLabel(schedule: string) {
  const [, ...rest] = schedule.split(":")
  return rest.join(":").trim()
}

export function sessionKey(workshopId: string, dateKey: string, timeLabel: string) {
  return `${workshopId}|${dateKey}|${timeLabel}`
}

export function normalizeTimeLabel(timeLabel: string) {
  return timeLabel.trim().replace(/\s+/g, " ")
}

export function classSeatPoolKey(dateKey: string, timeLabel: string) {
  return `studio-seat-pool|${dateKey}|${normalizeTimeLabel(timeLabel)}`
}

export function parsePreferredDate(preferredDate?: string | null) {
  if (!preferredDate) return null
  const [datePart = "", timePart = ""] = preferredDate.split("·").map((part) => part.trim())
  if (!datePart || !timePart) return null

  return {
    dateKey: datePart,
    timeLabel: timePart,
  }
}

export function buildWeekSessions(weekStart: Date) {
  return buildDefaultRangeSessions(weekStart, addDays(weekStart, 6))
}

export function buildDefaultRangeSessions(rangeStart: Date, rangeEnd: Date) {
  const defaultBookableIds = new Set(["beginner-wheel", "handbuilding", "kids-workshop", "3-day-workshop", "6-day-workshop"])
  const classWorkshops = workshops.filter((workshop) => workshop.available && defaultBookableIds.has(workshop.id))
  const start = new Date(rangeStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(rangeEnd)
  end.setHours(23, 59, 59, 999)

  return classWorkshops
    .flatMap((workshop) =>
      (workshop.schedule || []).flatMap((schedule) => {
        const days = parseScheduleDays(schedule)
        const timeLabel = parseTimeLabel(schedule)
        const dates: Date[] = []

        let date = new Date(start)
        while (date <= end) {
          if (days.includes(date.getDay())) dates.push(new Date(date))
          date = addDays(date, 1)
        }

        return dates.map((date) => {
          return {
            id: `${workshop.id}-${formatDateKey(date)}-${timeLabel}`,
            workshop,
            date,
            dateKey: formatDateKey(date),
            timeLabel,
            scheduleLabel: schedule,
            sortHour: parseTimeHour(timeLabel),
          }
        })
      })
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.sortHour - b.sortHour)
}

export function buildWeekSessionsFromSchedules(weekStart: Date, schedules: ClassScheduleLike[]) {
  const weekEnd = addDays(weekStart, 6)
  return buildRangeSessionsFromSchedules(weekStart, weekEnd, schedules)
}

export function buildRangeSessionsFromSchedules(rangeStart: Date, rangeEnd: Date, schedules: ClassScheduleLike[]) {
  const start = new Date(rangeStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(rangeEnd)
  end.setHours(23, 59, 59, 999)

  return schedules
    .flatMap((schedule) => {
      const offering = getScheduleOffering(schedule.offeringId)
      if (!offering) return []

      const endDate = schedule.endDate || (schedule.weekdays ? end : schedule.startDate)
      const dates: Date[] = []

      if (schedule.weekdays) {
        const weekdays = parseWeekdays(schedule.weekdays)
        let date = new Date(start)
        while (date <= end) {
          if (date < schedule.startDate || date > endDate) {
            date = addDays(date, 1)
            continue
          }
          if (weekdays.includes(date.getDay())) dates.push(date)
          date = addDays(date, 1)
        }
      } else {
        let date = new Date(schedule.startDate)
        while (date <= endDate && date <= end) {
          if (date >= start) dates.push(new Date(date))
          date = addDays(date, 1)
        }
      }

      return dates.map((date) => ({
        id: `${schedule.id}-${formatDateKey(date)}-${schedule.timeLabel}`,
        scheduleId: schedule.id,
        workshop: offering,
        date,
        dateKey: formatDateKey(date),
        timeLabel: schedule.timeLabel,
        scheduleLabel: schedule.weekdays ? "Recurring schedule" : "Scheduled run",
        sortHour: parseTimeHour(schedule.timeLabel),
        maxParticipants: schedule.maxParticipants,
        scheduleTitle: schedule.title,
        scheduleCategory: schedule.category,
        scheduleStartDate: schedule.startDate,
        scheduleEndDate: schedule.endDate,
        scheduleWeekdays: schedule.weekdays ? parseWeekdays(schedule.weekdays) : null,
      }))
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.sortHour - b.sortHour)
}
