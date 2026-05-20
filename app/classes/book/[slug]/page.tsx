"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock, Users } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatPrice } from "@/lib/classes-data"
import {
  addDays,
  CalendarAvailability,
  CalendarSession,
  formatDateKey,
  getScheduleOffering,
  parseDateKey,
  scheduleOfferings,
} from "@/lib/class-schedule"
import { cn } from "@/lib/utils"

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const requiredMultiDaySelections: Record<string, number> = {
  "3-day-workshop": 3,
  "6-day-workshop": 6,
}

interface WorkshopSequenceDay {
  date: Date
  dateKey: string
  session?: CalendarSession
  available: boolean
  reason?: string
}

interface WorkshopSequence {
  startSession: CalendarSession
  days: WorkshopSequenceDay[]
  isComplete: boolean
  hasUnavailableDays: boolean
  hasNonSuccessiveDays: boolean
  clayGapBlocked: boolean
  warning?: string
  blocker?: string
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function monthGridDays(monthStart: Date) {
  const start = new Date(monthStart)
  const mondayOffset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - mondayOffset)

  const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  const saturdayOffset = (6 - end.getDay() + 7) % 7
  end.setDate(end.getDate() + saturdayOffset)

  const days: Date[] = []
  let cursor = new Date(start)
  while (cursor <= end) {
    if (cursor.getDay() !== 0) days.push(new Date(cursor))
    cursor = addDays(cursor, 1)
  }
  return days
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function formatStartTime(timeLabel: string) {
  const [start = timeLabel] = timeLabel.split("-")
  const match = start.trim().match(/^(\d{1,2})(?::(\d{2}))?/)
  if (!match) return start.trim()

  const hour = Number(match[1])
  const minute = match[2] || "00"
  const suffix = hour >= 12 ? "pm" : "am"
  const displayHour = hour > 12 ? hour - 12 : hour
  return `${displayHour}${minute === "00" ? "" : `:${minute}`}${suffix}`
}

function isPrepaidProgram(session?: CalendarSession) {
  if (!session) return false
  return (
    session.scheduleCategory === "multi-day" ||
    session.scheduleCategory === "multi-week" ||
    session.scheduleCategory === "multi_week" ||
    session.workshop.id.includes("week") ||
    session.workshop.id === "3-day-workshop" ||
    session.workshop.id === "6-day-workshop"
  )
}

function buildProgramMeetings(session: CalendarSession) {
  const startDate = session.scheduleStartDate || session.date
  const endDate = session.scheduleEndDate || session.date
  const weekdays = session.scheduleWeekdays
  const meetings = []
  let date = new Date(startDate)

  while (date <= endDate) {
    if (!weekdays || weekdays.length === 0 || weekdays.includes(date.getDay())) {
      const dateKey = formatDateKey(date)
      meetings.push({
        key: `${dateKey}|${session.timeLabel}`,
        dateKey,
        dateLabel: date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
        timeLabel: session.timeLabel,
      })
    }
    date = addDays(date, 1)
  }

  return meetings
}

function daysBetween(first: Date, second: Date) {
  const dayMs = 24 * 60 * 60 * 1000
  const start = new Date(first)
  const end = new Date(second)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - start.getTime()) / dayMs)
}

function isWorkshopDay(date: Date) {
  return date.getDay() !== 0
}

export default function ClassMonthBookingPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])
  const [monthStart, setMonthStart] = useState(() => startOfMonth(today))
  const [sessions, setSessions] = useState<CalendarSession[]>([])
  const [availability, setAvailability] = useState<Record<string, CalendarAvailability>>({})
  const [selectedSessionId, setSelectedSessionId] = useState("")
  const [seats, setSeats] = useState("1")
  const [loading, setLoading] = useState(true)

  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const gridDays = useMemo(() => monthGridDays(monthStart), [monthStart])
  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = []
    for (let index = 0; index < gridDays.length; index += 6) {
      weeks.push(gridDays.slice(index, index + 6))
    }
    return weeks
  }, [gridDays])
  const workshop = sessions[0]?.workshop || scheduleOfferings.find((offering) => offering.slug === slug || offering.id === slug)
  const requiredProgramDays = workshop ? requiredMultiDaySelections[workshop.id] || 0 : 0
  const isMultiDaySelection = requiredProgramDays > 0
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) || null
  const buildSequenceForSession = (startSession: CalendarSession): WorkshopSequence => {
    const sequenceDays: WorkshopSequenceDay[] = []
    let cursor = new Date(startSession.date)

    while (sequenceDays.length < requiredProgramDays) {
      if (!isWorkshopDay(cursor)) {
        cursor = addDays(cursor, 1)
        continue
      }

      const dateKey = formatDateKey(cursor)
      const matchingSession = sessions.find(
        (session) => session.dateKey === dateKey && session.timeLabel === startSession.timeLabel
      )
      const matchingAvailability = matchingSession ? availability[matchingSession.id] : undefined
      const availableSeatsForDay = matchingSession
        ? matchingAvailability?.availableSeats ?? matchingSession.maxParticipants ?? matchingSession.workshop.maxParticipants ?? 0
        : 0
      const available = Boolean(matchingSession && availableSeatsForDay > 0)

      sequenceDays.push({
        date: new Date(cursor),
        dateKey,
        session: matchingSession,
        available,
        reason: available ? undefined : "This selected time slot is already fully booked.",
      })

      cursor = addDays(cursor, 1)
    }

    const gaps = sequenceDays.slice(1).map((day, index) => daysBetween(sequenceDays[index].date, day.date))
    const hasNonSuccessiveDays = gaps.some((gap) => gap > 1)
    const clayGapBlocked = gaps.some((gap) => gap > 2)
    const hasUnavailableDays = sequenceDays.some((day) => !day.available)

    return {
      startSession,
      days: sequenceDays,
      isComplete: sequenceDays.length === requiredProgramDays && !hasUnavailableDays && !clayGapBlocked,
      hasUnavailableDays,
      hasNonSuccessiveDays,
      clayGapBlocked,
      warning: hasNonSuccessiveDays
        ? "These workshop days are not all successive. Clay normally dries and is ready for trimming the next calendar day. It can be covered and held for one extra day if needed."
        : undefined,
      blocker: clayGapBlocked
        ? "This sequence leaves clay waiting more than 2 days before the next workshop day, so it cannot be booked."
        : hasUnavailableDays
          ? "One or more required workshop days are unavailable in this time slot."
          : undefined,
    }
  }
  const selectedSequence = isMultiDaySelection && selectedSession ? buildSequenceForSession(selectedSession) : null
  const activeSelectedSessions = isMultiDaySelection
    ? selectedSequence?.days.flatMap((day) => (day.session ? [day.session] : [])) || []
    : selectedSession
      ? [selectedSession]
      : []
  const displaySession = selectedSession
  const selectedAvailability = selectedSession ? availability[selectedSession.id] : undefined
  const availableSeats = selectedSession
    ? selectedAvailability?.availableSeats ?? selectedSession.maxParticipants ?? selectedSession.workshop.maxParticipants ?? 1
    : 0
  const programAvailableSeats = activeSelectedSessions.length > 0
    ? Math.min(
        ...activeSelectedSessions.map((session) =>
          availability[session.id]?.availableSeats ?? session.maxParticipants ?? session.workshop.maxParticipants ?? 1
        )
      )
    : 0
  const purchasableSeats = isMultiDaySelection ? programAvailableSeats : availableSeats
  const seatOptions = Array.from({ length: Math.max(purchasableSeats, 0) }, (_, index) => index + 1)
  const total = workshop ? workshop.price * Number(seats || 1) : 0
  const prepaid = isMultiDaySelection || isPrepaidProgram(selectedSession || undefined)
  const alternativeSequence = useMemo(() => {
    if (!isMultiDaySelection || !selectedSession) return null
    const startDaySessions = sessions.filter(
      (session) =>
        session.dateKey === selectedSession.dateKey &&
        session.timeLabel !== selectedSession.timeLabel &&
        (availability[session.id]?.availableSeats ?? 0) > 0
    )

    return startDaySessions
      .map((session) => buildSequenceForSession(session))
      .find((sequence) => sequence.isComplete) || null
  }, [availability, isMultiDaySelection, selectedSession, sessions])
  const canContinue = isMultiDaySelection
    ? Boolean(selectedSequence?.isComplete && purchasableSeats > 0)
    : Boolean(selectedSession && purchasableSeats > 0)

  useEffect(() => {
    let ignore = false

    async function loadMonth() {
      setLoading(true)
      try {
        const monthStarts = [
          new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1),
          monthStart,
          new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1),
        ]
        const responses = await Promise.all(
          monthStarts.map((date) => fetch(`/api/classes/availability?monthStart=${formatDateKey(date)}`))
        )
        if (responses.some((res) => !res.ok)) throw new Error("Could not load class availability")
        const months = await Promise.all(responses.map((res) => res.json()))
        if (ignore) return

        const nextAvailability = Object.fromEntries(
          months.flatMap((data) => data.availability as CalendarAvailability[]).map((item) => [item.sessionId, item])
        )
        const nextSessions = months.flatMap((data) => data.sessions || [])
          .map((session: {
            id: string
            scheduleId?: string
            workshopId: string
            title: string
            category: string
            dateKey: string
            timeLabel: string
            maxParticipants: number
            scheduleStartDate?: string
            scheduleEndDate?: string
            scheduleWeekdays?: number[]
          }) => {
            const offering = getScheduleOffering(session.workshopId)
            if (!offering || (offering.slug !== slug && offering.id !== slug)) return null
            const date = parseDateKey(session.dateKey)
            return {
              id: session.id,
              scheduleId: session.scheduleId,
              workshop: offering,
              date,
              dateKey: session.dateKey,
              timeLabel: session.timeLabel,
              scheduleLabel: session.category,
              sortHour: 0,
              maxParticipants: session.maxParticipants,
              scheduleTitle: session.title,
              scheduleCategory: session.category,
              scheduleStartDate: session.scheduleStartDate ? parseDateKey(session.scheduleStartDate) : undefined,
              scheduleEndDate: session.scheduleEndDate ? parseDateKey(session.scheduleEndDate) : null,
              scheduleWeekdays: session.scheduleWeekdays || null,
            }
          })
          .filter(Boolean) as CalendarSession[]

        setSessions(nextSessions)
        setAvailability(nextAvailability)
        setSelectedSessionId((current) => {
          if (requiredMultiDaySelections[nextSessions[0]?.workshop.id || ""]) return ""
          if (nextSessions.some((session) => session.id === current)) return current
          const firstAvailable = nextSessions.find((session) => (nextAvailability[session.id]?.availableSeats ?? 0) > 0)
          return firstAvailable?.id || nextSessions[0]?.id || ""
        })
        setSeats("1")
      } catch {
        if (!ignore) {
          setSessions([])
          setAvailability({})
          setSelectedSessionId("")
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadMonth()
    return () => {
      ignore = true
    }
  }, [monthStart, slug])

  useEffect(() => {
    if (Number(seats) > purchasableSeats) setSeats(Math.max(purchasableSeats, 1).toString())
  }, [purchasableSeats, seats])

  const moveMonth = (amount: number) => {
    setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + amount, 1))
  }

  const selectFirstSessionForDay = (date: Date) => {
    const dayKey = formatDateKey(date)
    const daySessions = sessions.filter((session) => session.dateKey === dayKey)
    const firstAvailable = daySessions.find((session) => (availability[session.id]?.availableSeats ?? 0) > 0)
    const nextSession = firstAvailable || daySessions[0]
    if (nextSession) {
      setSelectedSessionId(nextSession.id)
      setSeats("1")
    }
  }

  const checkoutHref = useMemo(() => {
    const programSessions = selectedSequence?.days.flatMap((day) => (day.session ? [day.session] : [])) || []
    const checkoutSession = isMultiDaySelection ? programSessions[0] : selectedSession
    if (!checkoutSession || !workshop) return "/classes/calendar"
    const params = new URLSearchParams({
      workshopId: workshop.id,
      title: checkoutSession.scheduleTitle || workshop.title,
      dateKey: formatDateKey(checkoutSession.date),
      dateLabel: isMultiDaySelection ? `${programSessions.length} selected days` : formatLongDate(checkoutSession.date),
      timeLabel: isMultiDaySelection ? "Selected program days" : checkoutSession.timeLabel,
      price: String(workshop.price),
      maxSeats: String(purchasableSeats),
      seats,
      prepaid: prepaid ? "true" : "false",
    })

    if (isMultiDaySelection) params.set("requiredMeetings", String(requiredProgramDays))
    if (checkoutSession.scheduleId) params.set("scheduleId", checkoutSession.scheduleId)
    if (prepaid) {
      const meetings = isMultiDaySelection
        ? programSessions.map((session) => ({
            key: `${session.dateKey}|${session.timeLabel}`,
            dateKey: session.dateKey,
            dateLabel: session.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
            timeLabel: session.timeLabel,
          }))
        : buildProgramMeetings(checkoutSession)
      params.set("meetings", JSON.stringify(meetings))
    }

    return `/classes/checkout?${params.toString()}`
  }, [isMultiDaySelection, prepaid, purchasableSeats, seats, selectedSequence, selectedSession, workshop])

  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <section className="border-b border-border bg-secondary/25 pt-24 pb-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" asChild className="mb-4 px-0">
            <Link href="/classes">
              <ArrowLeft className="h-4 w-4" />
              Back to classes
            </Link>
          </Button>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge variant="secondary" className="mb-3">Book a Class</Badge>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {workshop?.title || "Choose a class time"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {isMultiDaySelection
                  ? "Choose your starting day. We will automatically show the next available workshop days for your selected time slot. If your selected time slot is unavailable for the full workshop, we will show the unavailable days in red and suggest another available time when possible."
                  : "Choose an available day, select your seats, then continue to checkout."}
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href={`/classes/calendar?class=${workshop?.slug || slug}`}>See full calendar</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <Card className="overflow-hidden border-border">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => moveMonth(-1)} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="min-w-48 text-center font-heading text-xl font-bold text-foreground">{monthLabel}</h2>
              <Button variant="ghost" size="icon" onClick={() => moveMonth(1)} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="secondary" onClick={() => setMonthStart(startOfMonth(today))}>This Month</Button>
          </div>

          <CardContent className="p-0">
            <div className="hidden grid-cols-6 border-b border-border bg-muted/30 md:grid">
              {weekdayLabels.map((label) => (
                <div key={label} className="px-2 py-3 text-center text-xs font-semibold uppercase text-muted-foreground">
                  {label}
                </div>
              ))}
            </div>
            <div className="hidden grid-cols-6 md:grid">
              {gridDays.map((date) => {
                const dateKey = formatDateKey(date)
                const daySessions = sessions.filter((session) => session.dateKey === dateKey)
                const hasSessions = daySessions.length > 0
                const isCurrentMonth = date.getMonth() === monthStart.getMonth()
                const isToday = dateKey === formatDateKey(today)
                const sequenceDay = selectedSequence?.days.find((day) => day.dateKey === dateKey)
                const isSelected = isMultiDaySelection
                  ? Boolean(sequenceDay?.available)
                  : selectedSession?.dateKey === dateKey
                const isSequenceUnavailable = Boolean(sequenceDay && !sequenceDay.available)
                const sequenceSessionShown = Boolean(sequenceDay?.session && daySessions.some((session) => session.id === sequenceDay.session?.id))

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => selectFirstSessionForDay(date)}
                    disabled={!hasSessions && !isSequenceUnavailable}
                    className={cn(
                      "relative min-h-[104px] border-b border-r border-border p-2 pt-9 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-[118px]",
                      !isCurrentMonth && "bg-muted/20 text-muted-foreground/60",
                      hasSessions && "hover:bg-muted/50",
                      !hasSessions && "cursor-default",
                      isSelected && "bg-primary/5 ring-2 ring-inset ring-primary",
                      isSequenceUnavailable && "bg-destructive/10 ring-2 ring-inset ring-destructive"
                    )}
                    title={isSequenceUnavailable ? sequenceDay?.reason : undefined}
                  >
                    <span
                      className={cn(
                        "absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                        isToday && "bg-primary text-primary-foreground"
                      )}
                    >
                      {date.getDate()}
                    </span>
                    <div className="space-y-1">
                      {loading ? (
                        <span className="block rounded bg-muted px-2 py-1 text-xs text-muted-foreground">Checking</span>
                      ) : hasSessions ? (
                        <>
                          {daySessions.map((session) => {
                            const sessionAvailability = availability[session.id]
                            const left = sessionAvailability?.availableSeats ?? session.maxParticipants ?? session.workshop.maxParticipants ?? 0
                            const max = sessionAvailability?.maxParticipants ?? session.maxParticipants ?? session.workshop.maxParticipants ?? 0
                            const isFull = left <= 0
                            const isSequenceSession = sequenceDay?.session?.id === session.id
                            const isUnavailableSequenceSession = Boolean(isSequenceSession && sequenceDay && !sequenceDay.available)
                            return (
                              <span
                                key={session.id}
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setSelectedSessionId(session.id)
                                  setSeats("1")
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    setSelectedSessionId(session.id)
                                    setSeats("1")
                                  }
                                }}
                                className={cn(
                                  "block rounded-md border px-2 py-1.5 text-xs font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  isFull || isUnavailableSequenceSession ? "availability-full" : "availability-open"
                                )}
                                title={isUnavailableSequenceSession ? sequenceDay?.reason : undefined}
                              >
                                <span className="flex items-center justify-between gap-2">
                                  <span>{formatStartTime(session.timeLabel)}</span>
                                  <span>{left}/{max}</span>
                                </span>
                                {isMultiDaySelection && isSequenceSession && sequenceDay?.available && (
                                  <span className="mt-1 block font-semibold text-primary">Selected</span>
                                )}
                              </span>
                            )
                          })}
                          {isSequenceUnavailable && !sequenceSessionShown && (
                            <span className="block rounded-md border px-2 py-1.5 text-xs font-semibold shadow-sm availability-full" title={sequenceDay?.reason}>
                              <span className="flex items-center justify-between gap-2">
                                <span>{selectedSession ? formatStartTime(selectedSession.timeLabel) : "Selected time"}</span>
                                <span>0/{selectedSession?.maxParticipants ?? selectedSession?.workshop.maxParticipants ?? 3}</span>
                              </span>
                            </span>
                          )}
                        </>
                      ) : isSequenceUnavailable ? (
                        <span className="block rounded-md border px-2 py-1.5 text-xs font-semibold shadow-sm availability-full" title={sequenceDay?.reason}>
                          <span className="flex items-center justify-between gap-2">
                            <span>{selectedSession ? formatStartTime(selectedSession.timeLabel) : "Selected time"}</span>
                            <span>0/{selectedSession?.maxParticipants ?? selectedSession?.workshop.maxParticipants ?? 3}</span>
                          </span>
                        </span>
                      ) : isCurrentMonth && date.getDay() === 0 ? (
                        <span className="block rounded border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
                          Closed
                        </span>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="space-y-4 p-4 md:hidden">
              {calendarWeeks.map((week) => (
                <div key={formatDateKey(week[0])} className="rounded-lg border border-border">
                  <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                    Week of {week[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  <div className="divide-y divide-border">
                    {week
                      .filter((date) => date.getMonth() === monthStart.getMonth())
                      .map((date) => {
                        const dateKey = formatDateKey(date)
                        const daySessions = sessions.filter((session) => session.dateKey === dateKey)
                        const hasSessions = daySessions.length > 0
                        const isToday = dateKey === formatDateKey(today)
                        const sequenceDay = selectedSequence?.days.find((day) => day.dateKey === dateKey)
                        const isSelected = isMultiDaySelection
                          ? Boolean(sequenceDay?.available)
                          : selectedSession?.dateKey === dateKey
                        const isSequenceUnavailable = Boolean(sequenceDay && !sequenceDay.available)
                        const sequenceSessionShown = Boolean(sequenceDay?.session && daySessions.some((session) => session.id === sequenceDay.session?.id))

                        return (
                          <button
                            key={dateKey}
                            type="button"
                            onClick={() => selectFirstSessionForDay(date)}
                            disabled={!hasSessions && !isSequenceUnavailable}
                            className={cn(
                              "grid w-full grid-cols-[72px_1fr] gap-3 px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              hasSessions && "hover:bg-muted/50",
                              !hasSessions && "cursor-default",
                              isSelected && "bg-primary/5",
                              isSequenceUnavailable && "bg-destructive/10"
                            )}
                            title={isSequenceUnavailable ? sequenceDay?.reason : undefined}
                          >
                            <div>
                              <span className="block text-xs font-medium uppercase text-muted-foreground">
                                {date.toLocaleDateString("en-US", { weekday: "short" })}
                              </span>
                              <span
                                className={cn(
                                  "mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-foreground",
                                  isToday && "bg-primary text-primary-foreground"
                                )}
                              >
                                {date.getDate()}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {loading ? (
                                <span className="block rounded bg-muted px-2 py-1 text-xs text-muted-foreground">Checking</span>
                              ) : hasSessions ? (
                                <>
                                  {daySessions.map((session) => {
                                    const sessionAvailability = availability[session.id]
                                    const left = sessionAvailability?.availableSeats ?? session.maxParticipants ?? session.workshop.maxParticipants ?? 0
                                    const max = sessionAvailability?.maxParticipants ?? session.maxParticipants ?? session.workshop.maxParticipants ?? 0
                                    const isFull = left <= 0
                                    const isSequenceSession = sequenceDay?.session?.id === session.id
                                    const isUnavailableSequenceSession = Boolean(isSequenceSession && sequenceDay && !sequenceDay.available)
                                    return (
                                      <span
                                        key={session.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          setSelectedSessionId(session.id)
                                          setSeats("1")
                                        }}
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault()
                                            event.stopPropagation()
                                            setSelectedSessionId(session.id)
                                            setSeats("1")
                                          }
                                        }}
                                        className={cn(
                                          "block rounded-md border px-2 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                          isFull || isUnavailableSequenceSession ? "availability-full" : "availability-open"
                                        )}
                                        title={isUnavailableSequenceSession ? sequenceDay?.reason : undefined}
                                      >
                                        <span className="flex items-center justify-between gap-2">
                                          <span>{formatStartTime(session.timeLabel)}</span>
                                          <span>{left}/{max}</span>
                                        </span>
                                        {isMultiDaySelection && isSequenceSession && sequenceDay?.available && (
                                          <span className="mt-1 block font-semibold text-primary">Selected</span>
                                        )}
                                      </span>
                                    )
                                  })}
                                  {isSequenceUnavailable && !sequenceSessionShown && (
                                    <span className="block rounded-md border px-2 py-1.5 text-xs font-semibold availability-full" title={sequenceDay?.reason}>
                                      <span className="flex items-center justify-between gap-2">
                                        <span>{selectedSession ? formatStartTime(selectedSession.timeLabel) : "Selected time"}</span>
                                        <span>0/{selectedSession?.maxParticipants ?? selectedSession?.workshop.maxParticipants ?? 3}</span>
                                      </span>
                                    </span>
                                  )}
                                </>
                              ) : isSequenceUnavailable ? (
                                <span className="block rounded-md border px-2 py-1.5 text-xs font-semibold availability-full" title={sequenceDay?.reason}>
                                  <span className="flex items-center justify-between gap-2">
                                    <span>{selectedSession ? formatStartTime(selectedSession.timeLabel) : "Selected time"}</span>
                                    <span>0/{selectedSession?.maxParticipants ?? selectedSession?.workshop.maxParticipants ?? 3}</span>
                                  </span>
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">No class times</span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="border-border">
            <CardContent className="space-y-5 p-6">
              <div>
                <p className="text-sm font-semibold text-foreground">Selected booking</p>
                {displaySession ? (
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="font-heading text-2xl font-bold text-foreground">
                        {workshop?.title || displaySession.scheduleTitle || displaySession.workshop.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isMultiDaySelection
                          ? `${selectedSequence?.days.filter((day) => day.available).length || 0} of ${requiredProgramDays} days available`
                          : formatLongDate(selectedSession.date)}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md bg-muted/60 p-3">
                        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          Time
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                          {isMultiDaySelection ? "Selected days" : displaySession.timeLabel}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/60 p-3">
                        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          Seats
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                          {purchasableSeats <= 0 ? "Full" : `${purchasableSeats} available`}
                        </p>
                      </div>
                    </div>
                    {isMultiDaySelection && (
                      <div className="space-y-2 rounded-md border border-border p-3">
                        {!selectedSequence ? (
                          <p className="text-sm text-muted-foreground">Choose your starting day on the calendar.</p>
                        ) : (
                          selectedSequence.days.map((day) => (
                            <div key={day.dateKey} className="flex items-center justify-between gap-3 text-sm">
                              <span className={cn("text-muted-foreground", !day.available && "text-destructive")}>
                                {day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                {" · "}
                                {day.session?.timeLabel || selectedSession?.timeLabel}
                              </span>
                              <span className={cn("text-xs font-medium", day.available ? "text-success" : "text-destructive")}>
                                {day.available ? "Available" : "Unavailable"}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                    {selectedSequence?.warning && (
                      <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-sm leading-relaxed text-foreground">
                        {selectedSequence.warning}
                      </div>
                    )}
                    {selectedSequence?.blocker && (
                      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm leading-relaxed text-destructive">
                        {selectedSequence.blocker}
                      </div>
                    )}
                    {alternativeSequence && selectedSequence?.hasUnavailableDays && (
                      <div className="space-y-3 rounded-md border border-accent/40 bg-accent/10 p-3 text-sm leading-relaxed text-foreground">
                        <p>
                          The {formatStartTime(selectedSession.timeLabel)} class is not available for all required workshop days. {formatStartTime(alternativeSequence.startSession.timeLabel)} slots are available for this workshop sequence. Please switch to the {formatStartTime(alternativeSequence.startSession.timeLabel)} class to continue.
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedSessionId(alternativeSequence.startSession.id)
                            setSeats("1")
                          }}
                        >
                          Switch to {formatStartTime(alternativeSequence.startSession.timeLabel)}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Select a day with availability to build your booking.
                  </p>
                )}
              </div>

              {displaySession && purchasableSeats > 0 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="month-booking-seats">Seats</Label>
                    <Select value={seats} onValueChange={setSeats}>
                      <SelectTrigger id="month-booking-seats">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {seatOptions.map((count) => (
                          <SelectItem key={count} value={count.toString()}>
                            {count} {count === 1 ? "seat" : "seats"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-md border border-border p-4 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{formatPrice(workshop?.price || displaySession.workshop.price)}</span>
                      <span>x {seats}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground">
                      <span>Total</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                  </div>

                  <Button asChild className="h-12 w-full text-base">
                    <Link
                      href={checkoutHref}
                      aria-disabled={!canContinue}
                      className={cn(!canContinue && "pointer-events-none opacity-50")}
                    >
                      <CalendarDays className="h-4 w-4" />
                      {isMultiDaySelection && !canContinue
                        ? "Choose another start time"
                        : "Continue to Checkout"}
                    </Link>
                  </Button>
                </>
              )}

              {displaySession && purchasableSeats <= 0 && (
                <Button disabled className="h-12 w-full text-base">Session Full</Button>
              )}
            </CardContent>
          </Card>
        </aside>
      </section>
      <Footer />
    </main>
  )
}
