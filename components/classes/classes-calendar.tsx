"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MessageCircle,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"
import { formatPrice, Workshop, workshops } from "@/lib/classes-data"
import { cn } from "@/lib/utils"

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const shortDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const classColors: Record<string, string> = {
  "beginner-wheel": "border-l-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100",
  handbuilding: "border-l-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100",
  "3-day-workshop": "border-l-sky-500 bg-sky-50 text-sky-950 dark:bg-sky-950/30 dark:text-sky-100",
  "6-day-workshop": "border-l-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-100",
  "kids-workshop": "border-l-violet-500 bg-violet-50 text-violet-950 dark:bg-violet-950/30 dark:text-violet-100",
}

interface CalendarSession {
  id: string
  workshop: Workshop
  date: Date
  dateKey: string
  timeLabel: string
  scheduleLabel: string
  sortHour: number
}

interface ClassesCalendarProps {
  initialClass?: string
}

function startOfWeek(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  const mondayOffset = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - mondayOffset)
  return copy
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function formatDateKey(date: Date) {
  return date.toLocaleDateString("en-CA")
}

function parseTimeHour(timeLabel: string) {
  const match = timeLabel.match(/(\d{1,2})(?::(\d{2}))?/)
  return match ? Number(match[1]) : 12
}

function parseScheduleDays(schedule: string) {
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

function parseTimeLabel(schedule: string) {
  const [, ...rest] = schedule.split(":")
  return rest.join(":").trim()
}

function buildWeekSessions(weekStart: Date) {
  const classWorkshops = workshops.filter((workshop) => workshop.available && workshop.category !== "residency")

  return classWorkshops
    .flatMap((workshop) =>
      (workshop.schedule || []).flatMap((schedule) => {
        const days = parseScheduleDays(schedule)
        const timeLabel = parseTimeLabel(schedule)

        return days.map((dayIndex) => {
          const weekDayOffset = (dayIndex + 6) % 7
          const date = addDays(weekStart, weekDayOffset)

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

function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function ClassesCalendar({ initialClass }: ClassesCalendarProps) {
  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))
  const sessions = useMemo(() => buildWeekSessions(weekStart), [weekStart])
  const initialSession = useMemo(() => {
    return sessions.find((session) => session.workshop.slug === initialClass || session.workshop.id === initialClass) || sessions[0]
  }, [initialClass, sessions])
  const [selectedSessionId, setSelectedSessionId] = useState(initialSession?.id || "")
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) || initialSession
  const [people, setPeople] = useState("1")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const { isAuthenticated, openAuthModal } = useAuth()

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${addDays(weekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
  const activeMaxParticipants = selectedSession?.workshop.maxParticipants ?? 8
  const participantOptions = Array.from({ length: activeMaxParticipants }, (_, index) => index + 1)

  const moveWeek = (weeks: number) => {
    const nextWeek = addDays(weekStart, weeks * 7)
    setWeekStart(nextWeek)
    const nextSessions = buildWeekSessions(nextWeek)
    const nextSelected =
      nextSessions.find((session) => session.workshop.id === selectedSession?.workshop.id) || nextSessions[0]
    setSelectedSessionId(nextSelected?.id || "")
    setPeople("1")
    setError("")
  }

  const handleSelectSession = (session: CalendarSession) => {
    setSelectedSessionId(session.id)
    setPeople("1")
    setError("")
  }

  const handleBooking = async () => {
    if (!selectedSession) return
    setError("")

    if (!isAuthenticated) {
      openAuthModal()
      return
    }

    setIsSubmitting(true)

    try {
      const participants = parseInt(people)
      const preferredDate = `${formatDateKey(selectedSession.date)} · ${selectedSession.timeLabel}`
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workshopId: selectedSession.workshop.id,
          preferredDate,
          participants,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Could not create booking request")
      }

      const message = `Hi Backus Ceramics! I'd like to book the "${selectedSession.workshop.title}" for ${people} ${participants === 1 ? "person" : "people"}. Requested date: ${formatLongDate(selectedSession.date)}. Preferred time: ${selectedSession.timeLabel}.`
      window.open(`https://wa.me/6282145890402?text=${encodeURIComponent(message)}`, "_blank")
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : "Could not create booking request")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-secondary/25 pt-28 pb-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" asChild className="mb-6 px-0">
            <Link href="/classes">
              <ArrowLeft className="h-4 w-4" />
              Class guide
            </Link>
          </Button>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge variant="secondary" className="mb-4">Class Calendar</Badge>
              <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                Choose a day that fits.
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Browse the studio week, compare class times at a glance, and select a session to see details before booking.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background p-1">
              <Button variant="ghost" size="icon" onClick={() => moveWeek(-1)} aria-label="Previous week">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-48 px-3 text-center text-sm font-medium text-foreground">{weekLabel}</div>
              <Button variant="ghost" size="icon" onClick={() => moveWeek(1)} aria-label="Next week">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-7 border-b border-border bg-muted/35">
                {weekDays.map((date) => {
                  const isToday = formatDateKey(date) === formatDateKey(today)
                  return (
                    <div key={date.toISOString()} className="border-r border-border p-4 last:border-r-0">
                      <p className="text-xs font-medium uppercase text-muted-foreground">{shortDayNames[date.getDay()]}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={cn("flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold", isToday && "bg-primary text-primary-foreground")}>
                          {date.getDate()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {date.toLocaleDateString("en-US", { month: "short" })}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-7">
                {weekDays.map((date) => {
                  const daySessions = sessions.filter((session) => session.dateKey === formatDateKey(date))
                return (
                  <div key={date.toISOString()} className="min-h-[520px] border-r border-border bg-background p-3 last:border-r-0">
                    <div className="space-y-3">
                      {daySessions.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                          Studio closed
                        </div>
                      ) : (
                        daySessions.map((session) => (
                          <button
                            key={session.id}
                            type="button"
                            onClick={() => handleSelectSession(session)}
                            className={cn(
                              "w-full rounded-md border border-border border-l-4 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              classColors[session.workshop.id],
                              selectedSession?.id === session.id && "ring-2 ring-primary"
                            )}
                          >
                            <span className="block text-xs font-semibold">{session.timeLabel}</span>
                            <span className="mt-1 block text-sm font-semibold leading-tight">{session.workshop.title}</span>
                            <span className="mt-2 flex items-center gap-1 text-xs opacity-80">
                              <Users className="h-3 w-3" />
                              Max {session.workshop.maxParticipants ?? 8}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )
                })}
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          {selectedSession && (
            <Card className="overflow-hidden border-border shadow-sm">
              {selectedSession.workshop.image && (
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  <img
                    src={selectedSession.workshop.image}
                    alt={selectedSession.workshop.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <CardContent className="space-y-5 p-6">
                <div>
                  <Badge variant="outline">{selectedSession.workshop.level}</Badge>
                  <h2 className="mt-3 font-heading text-2xl font-bold text-foreground">{selectedSession.workshop.title}</h2>
                  <p className="mt-1 text-sm font-medium uppercase tracking-wide text-primary">{selectedSession.workshop.subtitle}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-muted/60 p-3">
                    <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Date
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{formatLongDate(selectedSession.date)}</p>
                  </div>
                  <div className="rounded-md bg-muted/60 p-3">
                    <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Time
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{selectedSession.timeLabel}</p>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-muted-foreground">{selectedSession.workshop.description}</p>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Price</p>
                    <p className="font-semibold text-foreground">{formatPrice(selectedSession.workshop.price)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Class size</p>
                    <p className="font-semibold text-foreground">Up to {activeMaxParticipants}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="calendar-people">Seats</Label>
                  <Select value={people} onValueChange={setPeople}>
                    <SelectTrigger id="calendar-people">
                      <SelectValue placeholder="Select seats" />
                    </SelectTrigger>
                    <SelectContent>
                      {participantOptions.map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} {num === 1 ? "Person" : "People"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  onClick={handleBooking}
                  className="h-12 w-full gap-2 bg-[#25D366] text-base text-white hover:bg-[#128C7E]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  {isSubmitting ? "Creating Booking..." : isAuthenticated ? "Book via WhatsApp" : "Sign in to Book"}
                </Button>
              </CardContent>
            </Card>
          )}
        </aside>
      </section>
    </main>
  )
}
