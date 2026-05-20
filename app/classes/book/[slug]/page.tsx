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

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const requiredMultiDaySelections: Record<string, number> = {
  "3-day-workshop": 3,
  "6-day-workshop": 6,
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function monthGridDays(monthStart: Date) {
  const start = new Date(monthStart)
  const mondayOffset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - mondayOffset)

  const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  const sundayOffset = (7 - end.getDay()) % 7
  end.setDate(end.getDate() + sundayOffset)

  const days: Date[] = []
  let cursor = new Date(start)
  while (cursor <= end) {
    days.push(new Date(cursor))
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
  const [selectedProgramSessions, setSelectedProgramSessions] = useState<CalendarSession[]>([])
  const [seats, setSeats] = useState("1")
  const [loading, setLoading] = useState(true)

  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const gridDays = useMemo(() => monthGridDays(monthStart), [monthStart])
  const workshop = sessions[0]?.workshop || scheduleOfferings.find((offering) => offering.slug === slug || offering.id === slug)
  const requiredProgramDays = workshop ? requiredMultiDaySelections[workshop.id] || 0 : 0
  const isMultiDaySelection = requiredProgramDays > 0
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) || null
  const activeSelectedSessions = isMultiDaySelection ? selectedProgramSessions : selectedSession ? [selectedSession] : []
  const displaySession = isMultiDaySelection ? activeSelectedSessions[0] || null : selectedSession
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
  const canContinue = isMultiDaySelection
    ? selectedProgramSessions.length === requiredProgramDays && purchasableSeats > 0
    : Boolean(selectedSession && purchasableSeats > 0)

  useEffect(() => {
    let ignore = false

    async function loadMonth() {
      setLoading(true)
      try {
        const res = await fetch(`/api/classes/availability?monthStart=${formatDateKey(monthStart)}`)
        if (!res.ok) throw new Error("Could not load class availability")
        const data = await res.json()
        if (ignore) return

        const nextAvailability = Object.fromEntries(
          (data.availability as CalendarAvailability[]).map((item) => [item.sessionId, item])
        )
        const nextSessions = (data.sessions || [])
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
      if (isMultiDaySelection) {
        setSelectedProgramSessions((current) => {
          if (current.some((session) => session.id === nextSession.id)) {
            return current.filter((session) => session.id !== nextSession.id)
          }
          if ((availability[nextSession.id]?.availableSeats ?? 0) <= 0) return current
          if (current.length >= requiredProgramDays) return current
          return [...current, nextSession].sort((a, b) => a.date.getTime() - b.date.getTime())
        })
        setSelectedSessionId(nextSession.id)
        setSeats("1")
        return
      }
      setSelectedSessionId(nextSession.id)
      setSeats("1")
    }
  }

  const checkoutHref = useMemo(() => {
    const checkoutSession = isMultiDaySelection ? selectedProgramSessions[0] : selectedSession
    if (!checkoutSession || !workshop) return "/classes/calendar"
    const params = new URLSearchParams({
      workshopId: workshop.id,
      title: checkoutSession.scheduleTitle || workshop.title,
      dateKey: formatDateKey(checkoutSession.date),
      dateLabel: isMultiDaySelection ? `${selectedProgramSessions.length} selected days` : formatLongDate(checkoutSession.date),
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
        ? selectedProgramSessions.map((session) => ({
            key: `${session.dateKey}|${session.timeLabel}`,
            dateKey: session.dateKey,
            dateLabel: session.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
            timeLabel: session.timeLabel,
          }))
        : buildProgramMeetings(checkoutSession)
      params.set("meetings", JSON.stringify(meetings))
    }

    return `/classes/checkout?${params.toString()}`
  }, [isMultiDaySelection, prepaid, purchasableSeats, seats, selectedProgramSessions, selectedSession, workshop])

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
                  ? `Choose exactly ${requiredProgramDays} available days, select your seats, then continue to checkout.`
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
            <div className="grid grid-cols-7 border-b border-border bg-muted/30">
              {weekdayLabels.map((label) => (
                <div key={label} className="px-2 py-3 text-center text-xs font-semibold uppercase text-muted-foreground">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {gridDays.map((date) => {
                const dateKey = formatDateKey(date)
                const daySessions = sessions.filter((session) => session.dateKey === dateKey)
                const hasSessions = daySessions.length > 0
                const isCurrentMonth = date.getMonth() === monthStart.getMonth()
                const isToday = dateKey === formatDateKey(today)
                const isSelected = isMultiDaySelection
                  ? selectedProgramSessions.some((session) => session.dateKey === dateKey)
                  : selectedSession?.dateKey === dateKey

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => selectFirstSessionForDay(date)}
                    disabled={!hasSessions}
                    className={cn(
                      "min-h-[118px] border-b border-r border-border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[150px]",
                      !isCurrentMonth && "bg-muted/20 text-muted-foreground/60",
                      hasSessions && "hover:bg-muted/50",
                      !hasSessions && "cursor-default",
                      isSelected && "bg-primary/5 ring-2 ring-inset ring-primary"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                        isToday && "bg-primary text-primary-foreground"
                      )}
                    >
                      {date.getDate()}
                    </span>
                    <div className="mt-2 space-y-1.5">
                      {loading ? (
                        <span className="block rounded bg-muted px-2 py-1 text-xs text-muted-foreground">Checking</span>
                      ) : hasSessions ? (
                        daySessions.slice(0, 2).map((session) => {
                          const sessionAvailability = availability[session.id]
                          const left = sessionAvailability?.availableSeats ?? session.maxParticipants ?? session.workshop.maxParticipants ?? 0
                          return (
                            <span key={session.id} className="block rounded-md bg-background px-2 py-1.5 text-xs shadow-sm">
                              <span className="block font-semibold text-foreground">{session.timeLabel}</span>
                              <span className={cn("text-muted-foreground", left <= 0 && "text-destructive")}>
                                {left <= 0 ? "Full" : `${left} seats left`}
                              </span>
                              {isMultiDaySelection && selectedProgramSessions.some((selected) => selected.id === session.id) && (
                                <span className="mt-1 block font-semibold text-primary">Selected</span>
                              )}
                            </span>
                          )
                        })
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
                          ? `${selectedProgramSessions.length} of ${requiredProgramDays} days selected`
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
                        {selectedProgramSessions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Choose your first day on the calendar.</p>
                        ) : (
                          selectedProgramSessions.map((session) => (
                            <div key={session.id} className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-muted-foreground">
                                {session.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                {" · "}
                                {session.timeLabel}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedProgramSessions((current) => current.filter((item) => item.id !== session.id))}
                                className="text-xs font-medium text-destructive"
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        )}
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
                      <span>{formatPrice(selectedSession.workshop.price)}</span>
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
                        ? `Choose ${requiredProgramDays - selectedProgramSessions.length} more`
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
