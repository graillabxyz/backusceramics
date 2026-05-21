import { parseStartTime } from "@/lib/class-schedule"

export interface CalendarExportEvent {
  title: string
  dateKey: string
  timeLabel: string
  description?: string
  location?: string
}

const studioLocation = "Backus Ceramics, Jl. Bantan Kangin No.1, Canggu, Kec. Kuta Utara, Kabupaten Badung, Bali 80631"

function pad(value: number) {
  return value.toString().padStart(2, "0")
}

function parseEndTime(timeLabel: string) {
  const [, endPart = ""] = timeLabel.split("-")
  if (!endPart.trim()) {
    const start = parseStartTime(timeLabel)
    return { hour: start.hour + 2, minute: start.minute }
  }

  const match = endPart.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (!match) {
    const start = parseStartTime(timeLabel)
    return { hour: start.hour + 2, minute: start.minute }
  }

  let hour = Number(match[1])
  const minute = Number(match[2] || 0)
  const suffix = match[3]
  const hasAfternoonContext = timeLabel.toLowerCase().includes("pm")

  if (suffix === "pm" && hour < 12) hour += 12
  if (suffix === "am" && hour === 12) hour = 0
  if (!suffix && hasAfternoonContext && hour > 0 && hour < 8) hour += 12

  return { hour, minute }
}

function zonedDate(dateKey: string, time: { hour: number; minute: number }) {
  return new Date(`${dateKey}T${pad(time.hour)}:${pad(time.minute)}:00+08:00`)
}

function formatUtcDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
}

function eventDates(event: CalendarExportEvent) {
  const start = zonedDate(event.dateKey, parseStartTime(event.timeLabel))
  const end = zonedDate(event.dateKey, parseEndTime(event.timeLabel))
  return { start, end }
}

export function canExportCalendarEvent(event: Pick<CalendarExportEvent, "dateKey" | "timeLabel">) {
  return /^\d{4}-\d{2}-\d{2}$/.test(event.dateKey) && Boolean(event.timeLabel)
}

export function parsePreferredDateForCalendar(preferredDate?: string | null) {
  if (!preferredDate) return null
  const [dateKey = "", timeLabel = ""] = preferredDate.split("·").map((part) => part.trim())
  if (!canExportCalendarEvent({ dateKey, timeLabel })) return null
  return { dateKey, timeLabel }
}

export function buildGoogleCalendarUrl(event: CalendarExportEvent) {
  const { start, end } = eventDates(event)
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${formatUtcDate(start)}/${formatUtcDate(end)}`,
    details: event.description || "Backus Ceramics booking",
    location: event.location || studioLocation,
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function buildIcsContent(event: CalendarExportEvent) {
  const { start, end } = eventDates(event)
  const now = formatUtcDate(new Date())
  const uid = `${event.dateKey}-${event.timeLabel}-${event.title}@backusceramics.com`.replace(/[^a-zA-Z0-9@.-]/g, "-")

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Backus Ceramics//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatUtcDate(start)}`,
    `DTEND:${formatUtcDate(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description || "Backus Ceramics booking")}`,
    `LOCATION:${escapeIcsText(event.location || studioLocation)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}

export function buildIcsDataUrl(event: CalendarExportEvent) {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcsContent(event))}`
}
