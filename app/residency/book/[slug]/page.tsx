"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { BrandClosingSection } from "@/components/brand-closing-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { formatPrice, workshops } from "@/lib/classes-data"
import { addDays, CalendarAvailability, CalendarSession, formatDateKey, getScheduleOffering, hasSessionStartPassed, parseDateKey } from "@/lib/class-schedule"
import { cn } from "@/lib/utils"

type ResidencyFocus = "wheel" | "handbuilding" | "mix"

interface ResidencySlot {
  workshopId: string
  title: string
  timeLabel: string
  focus: ResidencyFocus
  capacity: number
}

interface SelectedDay {
  dateKey: string
  timeLabel: string
}

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const residencyWeeks: Record<string, number> = {
  "3-week-residency": 3,
  "6-week-residency": 6,
}

const residencySlots: ResidencySlot[] = [
  { workshopId: "beginner-wheel", title: "Wheel", timeLabel: "10:00 - 12:00 PM", focus: "wheel", capacity: 3 },
  { workshopId: "beginner-wheel", title: "Wheel", timeLabel: "12:00 - 14:00 PM", focus: "wheel", capacity: 3 },
  { workshopId: "handbuilding", title: "Handbuilding", timeLabel: "14:00 - 16:00 PM", focus: "handbuilding", capacity: 8 },
]

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate())
}

function monthGridDays(monthStart: Date) {
  const start = new Date(monthStart)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  end.setDate(end.getDate() + ((6 - end.getDay() + 7) % 7))

  const days: Date[] = []
  let cursor = new Date(start)
  while (cursor <= end) {
    if (cursor.getDay() !== 0) days.push(new Date(cursor))
    cursor = addDays(cursor, 1)
  }
  return days
}

function weekKey(date: Date) {
  const monday = new Date(date)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return formatDateKey(monday)
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

function isSameOrAfter(first: Date, second: Date) {
  const a = new Date(first)
  const b = new Date(second)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return a >= b
}

function isSameOrBefore(first: Date, second: Date) {
  const a = new Date(first)
  const b = new Date(second)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return a <= b
}

function focusLabel(focus: ResidencyFocus) {
  if (focus === "wheel") return "Wheel lessons"
  if (focus === "handbuilding") return "Handbuilding"
  return "Wheel and handbuilding"
}

export default function ResidencyBookingPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const program = workshops.find((workshop) => workshop.category === "residency" && (workshop.slug === slug || workshop.id === slug))
  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])
  const [monthStart, setMonthStart] = useState(() => startOfMonth(today))
  const [sessions, setSessions] = useState<CalendarSession[]>([])
  const [availability, setAvailability] = useState<Record<string, CalendarAvailability>>({})
  const [selectedDays, setSelectedDays] = useState<Record<string, SelectedDay>>({})
  const [focus, setFocus] = useState<ResidencyFocus>("wheel")
  const [manualTimes, setManualTimes] = useState(false)
  const [loading, setLoading] = useState(true)

  const durationWeeks = program ? residencyWeeks[program.id] || 3 : 3
  const requiredDays = durationWeeks * 5
  const bookingWindowEnd = useMemo(() => {
    const date = addMonths(today, 6)
    date.setHours(23, 59, 59, 999)
    return date
  }, [today])
  const minMonthStart = useMemo(() => startOfMonth(today), [today])
  const maxMonthStart = useMemo(() => startOfMonth(bookingWindowEnd), [bookingWindowEnd])
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const canMovePrevious = monthStart > minMonthStart
  const canMoveNext = monthStart < maxMonthStart
  const gridDays = useMemo(() => monthGridDays(monthStart), [monthStart])
  const selectedEntries = useMemo(() => Object.values(selectedDays).sort((a, b) => a.dateKey.localeCompare(b.dateKey)), [selectedDays])
  const selectedCount = selectedEntries.length
  const selectedWeekCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const day of selectedEntries) {
      const key = weekKey(parseDateKey(day.dateKey))
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return counts
  }, [selectedEntries])
  const sessionsByKey = useMemo(() => {
    const map = new Map<string, CalendarSession>()
    for (const session of sessions) map.set(`${session.workshop.id}|${session.dateKey}|${session.timeLabel}`, session)
    return map
  }, [sessions])

  function orderedSlotsForFocus(nextFocus = focus) {
    if (nextFocus === "wheel") return residencySlots.filter((slot) => slot.focus === "wheel")
    if (nextFocus === "handbuilding") return residencySlots.filter((slot) => slot.focus === "handbuilding")
    return residencySlots
  }

  function orderedSlotsForDate(dateKey: string, nextFocus = focus) {
    const date = parseDateKey(dateKey)
    const slots = orderedSlotsForFocus(nextFocus)
    const upcomingSlots = slots.filter((slot) => !hasSessionStartPassed(dateKey, slot.timeLabel))
    if (date.getDay() === 6) {
      return upcomingSlots.filter((slot) => slot.workshopId === "beginner-wheel" && slot.timeLabel === "12:00 - 14:00 PM")
    }
    return upcomingSlots
  }

  function getSlotAvailability(dateKey: string, slot: ResidencySlot) {
    const session = sessionsByKey.get(`${slot.workshopId}|${dateKey}|${slot.timeLabel}`)
    if (!session) return { availableSeats: 0, maxParticipants: slot.capacity, session: null }
    const sessionAvailability = availability[session.id]
    const maxParticipants = sessionAvailability?.maxParticipants ?? session.maxParticipants ?? slot.capacity
    const availableSeats = sessionAvailability?.availableSeats ?? maxParticipants
    return { availableSeats, maxParticipants, session }
  }

  function suggestedSlotForDate(dateKey: string) {
    return orderedSlotsForDate(dateKey).find((slot) => getSlotAvailability(dateKey, slot).availableSeats > 0)
  }

  function selectDay(date: Date) {
    const dateKey = formatDateKey(date)
    if (selectedDays[dateKey]) {
      setSelectedDays((current) => {
        const next = { ...current }
        delete next[dateKey]
        return next
      })
      return
    }
    if (selectedCount >= requiredDays) return
    if ((selectedWeekCounts.get(weekKey(date)) || 0) >= 5) return
    const suggested = suggestedSlotForDate(dateKey)
    if (!suggested) return
    setSelectedDays((current) => ({ ...current, [dateKey]: { dateKey, timeLabel: suggested.timeLabel } }))
  }

  function updateSelectedTime(dateKey: string, timeLabel: string) {
    setSelectedDays((current) => ({ ...current, [dateKey]: { dateKey, timeLabel } }))
  }

  function moveMonth(amount: number) {
    const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + amount, 1)
    if (nextMonth < minMonthStart) return setMonthStart(minMonthStart)
    if (nextMonth > maxMonthStart) return setMonthStart(maxMonthStart)
    setMonthStart(nextMonth)
  }

  useEffect(() => {
    let ignore = false
    async function loadAvailability() {
      setLoading(true)
      try {
        const response = await fetch(`/api/classes/availability?monthStart=${formatDateKey(monthStart)}`)
        if (!response.ok) throw new Error("Could not load residency availability")
        const data = await response.json()
        if (ignore) return
        const nextAvailability = Object.fromEntries((data.availability as CalendarAvailability[]).map((item) => [item.sessionId, item]))
        const mappedSessions = (data.sessions || [])
          .map((session: { id: string; scheduleId?: string; workshopId: string; title: string; category: string; dateKey: string; timeLabel: string; maxParticipants: number }) => {
            const offering = getScheduleOffering(session.workshopId)
            if (!offering || !["beginner-wheel", "handbuilding"].includes(offering.id)) return null
            const date = parseDateKey(session.dateKey)
            if (date.getDay() === 0) return null
            if (!isSameOrAfter(date, today) || !isSameOrBefore(date, bookingWindowEnd)) return null
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
            }
          })
          .filter(Boolean) as CalendarSession[]
        setAvailability(nextAvailability)
        setSessions(mappedSessions)
      } catch {
        if (!ignore) {
          setAvailability({})
          setSessions([])
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    loadAvailability()
    return () => {
      ignore = true
    }
  }, [bookingWindowEnd, monthStart, today])

  useEffect(() => {
    setSelectedDays((current) => {
      const next: Record<string, SelectedDay> = {}
      for (const day of Object.values(current)) {
        const currentSlot = residencySlots.find((slot) => slot.timeLabel === day.timeLabel)
        const allowed = currentSlot && orderedSlotsForDate(day.dateKey).some((slot) => slot.timeLabel === currentSlot.timeLabel)
        if (manualTimes && allowed && getSlotAvailability(day.dateKey, currentSlot).availableSeats > 0) {
          next[day.dateKey] = day
        } else {
          const suggested = suggestedSlotForDate(day.dateKey)
          if (suggested) next[day.dateKey] = { dateKey: day.dateKey, timeLabel: suggested.timeLabel }
        }
      }
      return next
    })
  }, [focus])

  if (!program) {
    return (
      <main className="min-h-screen bg-background">
        <Navigation />
        <section className="mx-auto max-w-3xl px-4 py-32 text-center sm:px-6 lg:px-8">
          <h1 className="font-heading text-3xl font-bold text-foreground">Residency not found</h1>
          <Button asChild className="mt-6"><Link href="/residency">Back to residency programs</Link></Button>
        </section>
        <Footer />
      </main>
    )
  }

  const canContinue = selectedCount === requiredDays
  const checkoutHref = (() => {
    if (!canContinue) return "/residency"
    const meetings = selectedEntries.map((day) => {
      const slot = residencySlots.find((item) => item.timeLabel === day.timeLabel) || residencySlots[0]
      const date = parseDateKey(day.dateKey)
      return {
        key: `${day.dateKey}|${slot.timeLabel}`,
        dateKey: day.dateKey,
        dateLabel: date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
        timeLabel: slot.timeLabel,
        slotWorkshopId: slot.workshopId,
        slotTitle: `${slot.title} residency slot`,
        focus: focusLabel(focus),
      }
    })
    const params = new URLSearchParams({
      workshopId: program.id,
      title: program.title,
      dateKey: selectedEntries[0]?.dateKey || "",
      dateLabel: `${selectedCount} selected residency days`,
      timeLabel: manualTimes ? "Custom weekly residency schedule" : "Auto-assigned residency schedule",
      price: String(program.price),
      maxSeats: "1",
      seats: "1",
      prepaid: "true",
      requiredMeetings: String(requiredDays),
      meetings: JSON.stringify(meetings),
      focus: focusLabel(focus),
      returnTo: `/residency/book/${slug}`,
      returnLabel: `Back to ${program.title}`,
      source: "residency-booking",
    })
    return `/classes/checkout?${params.toString()}`
  })()

  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <section className="border-b border-border bg-secondary/25 pt-24 pb-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" asChild className="mb-4 gap-2 px-0">
            <Link href="/residency"><ArrowLeft className="h-4 w-4" />Residency programs</Link>
          </Button>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <Badge variant="secondary" className="mb-3">Residency booking</Badge>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-5xl">Choose your residency rhythm.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Resident students receive priority in the studio schedule. Booking further in advance helps us protect a reliable weekly rhythm for you, and you can message us on WhatsApp right after payment if any detail needs adjusting.
              </p>
            </div>
            <Card className="border-border bg-background/70">
              <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">{program.title}</p>
                <p>{durationWeeks} weeks · 5 days each week · {requiredDays} studio days total</p>
                <p>Book through {bookingWindowEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <div className="space-y-6">
          <Card className="border-border">
            <CardContent className="p-5 sm:p-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                <div className="space-y-4">
                  <div>
                    <Badge variant="secondary" className="mb-3">Step 1</Badge>
                    <h2 className="font-heading text-2xl font-bold text-foreground">Set your studio focus.</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      Choose the kind of work you want to prioritize. We will suggest a steady weekly rhythm, and you can take over the exact times if you prefer.
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold text-foreground">Focus area</Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {(["wheel", "handbuilding", "mix"] as ResidencyFocus[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setFocus(option)}
                        className={cn(
                          "min-h-20 rounded-md border px-4 py-3 text-left text-sm font-semibold transition",
                          focus === option
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-background/70 text-foreground hover:bg-secondary/40"
                        )}
                      >
                        <span>{focusLabel(option)}</span>
                      </button>
                    ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-border bg-muted/25 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Time selection</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Auto-assign each day at 10am first, then 12pm, then 2pm when needed.
                      </p>
                    </div>
                    <Switch checked={manualTimes} onCheckedChange={setManualTimes} aria-label="Select times manually" />
                  </div>
                  <div className="rounded-md border border-border bg-background/60 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {manualTimes ? "Manual mode on" : "Automatic mode on"}
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {manualTimes
                        ? "Choose the time for each selected residency day in the summary panel."
                        : "We will place each selected day into the earliest available matching slot."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-border bg-secondary/20 px-4 py-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                Choose 5 days in each residency week. We avoid kids classes and only use regular studio slots that can support resident work, including the 12pm Saturday slot when available.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border">
            <CardContent className="p-0">
              <div className="flex flex-col gap-4 border-b border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => moveMonth(-1)} disabled={!canMovePrevious} aria-label="Previous month"><ChevronLeft className="h-5 w-5" /></Button>
                  <h2 className="min-w-[180px] text-center font-heading text-2xl font-bold text-foreground">{monthLabel}</h2>
                  <Button variant="ghost" size="icon" onClick={() => moveMonth(1)} disabled={!canMoveNext} aria-label="Next month"><ChevronRight className="h-5 w-5" /></Button>
                </div>
                <Button variant="secondary" onClick={() => setMonthStart(startOfMonth(today))}>This Month</Button>
              </div>

              <div className="hidden grid-cols-6 border-b border-border bg-secondary/20 md:grid">
                {weekdayLabels.map((label) => <div key={label} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>)}
              </div>
              <div className="hidden grid-cols-6 md:grid">
                {gridDays.map((date, index) => {
                  const dateKey = formatDateKey(date)
                  const inCurrentMonth = date.getMonth() === monthStart.getMonth()
                  const inWindow = isSameOrAfter(date, today) && isSameOrBefore(date, bookingWindowEnd)
                  const selected = selectedDays[dateKey]
                  const suggested = suggestedSlotForDate(dateKey)
                  const weekCount = selectedWeekCounts.get(weekKey(date)) || 0
                  const disabled = !inCurrentMonth || !inWindow || !suggested || (!selected && (selectedCount >= requiredDays || weekCount >= 5))
                  const isToday = dateKey === formatDateKey(today)
                  const isLastRow = index >= gridDays.length - 6
                  return (
                    <button key={dateKey} type="button" onClick={() => selectDay(date)} disabled={disabled && !selected} className={cn("min-h-36 border-r border-border p-3 text-left transition", !isLastRow && "border-b", inCurrentMonth ? "bg-background hover:bg-secondary/20" : "bg-muted/20 text-muted-foreground", selected && "bg-primary/10 ring-2 ring-inset ring-primary", disabled && !selected && "cursor-default opacity-45")}>
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold", isToday && "bg-primary text-primary-foreground")}>{date.getDate()}</span>
                      {inCurrentMonth && inWindow && (
                        <div className="mt-5 space-y-1.5">
                          {orderedSlotsForDate(dateKey).map((slot) => {
                            const slotAvailability = getSlotAvailability(dateKey, slot)
                            return (
                              <span key={`${dateKey}-${slot.timeLabel}`} className={cn("block rounded-md border px-2 py-1 text-xs font-semibold", slotAvailability.availableSeats > 0 ? "border-olive-moss/50 text-olive-moss" : "border-destructive/50 text-destructive", selected?.timeLabel === slot.timeLabel && "border-primary bg-primary text-primary-foreground")}>
                                {formatStartTime(slot.timeLabel)} {slotAvailability.availableSeats}/{slotAvailability.maxParticipants}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-3 p-4 md:hidden">
                {gridDays.filter((date) => date.getMonth() === monthStart.getMonth() && isSameOrAfter(date, today) && isSameOrBefore(date, bookingWindowEnd)).map((date) => {
                  const dateKey = formatDateKey(date)
                  const selected = selectedDays[dateKey]
                  const suggested = suggestedSlotForDate(dateKey)
                  const weekCount = selectedWeekCounts.get(weekKey(date)) || 0
                  const disabled = !suggested || (!selected && (selectedCount >= requiredDays || weekCount >= 5))
                  return (
                    <button key={dateKey} type="button" onClick={() => selectDay(date)} disabled={disabled && !selected} className={cn("grid w-full grid-cols-[76px_1fr] gap-3 rounded-lg border border-border bg-background p-3 text-left", selected && "border-primary bg-primary/10", disabled && !selected && "opacity-45")}>
                      <div>
                        <span className="text-xs font-semibold uppercase text-muted-foreground">{date.toLocaleDateString("en-US", { weekday: "short" })}</span>
                        <span className="mt-1 block text-xl font-bold text-foreground">{date.getDate()}</span>
                      </div>
                      <div className="space-y-1.5">
                        {orderedSlotsForDate(dateKey).map((slot) => {
                          const slotAvailability = getSlotAvailability(dateKey, slot)
                          return (
                            <span key={slot.timeLabel} className={cn("flex items-center justify-between rounded-md border px-2 py-1 text-xs font-semibold", slotAvailability.availableSeats > 0 ? "border-olive-moss/50 text-olive-moss" : "border-destructive/50 text-destructive", selected?.timeLabel === slot.timeLabel && "border-primary bg-primary text-primary-foreground")}>
                              <span>{formatStartTime(slot.timeLabel)} {slot.title}</span>
                              <span>{slotAvailability.availableSeats}/{slotAvailability.maxParticipants}</span>
                            </span>
                          )
                        })}
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="border-border">
            <CardContent className="space-y-5 p-6">
              <div>
                <p className="text-sm font-semibold text-foreground">Residency summary</p>
                <h2 className="mt-2 font-heading text-2xl font-bold text-foreground">{program.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{focusLabel(focus)} · {selectedCount}/{requiredDays} days selected</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/35 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4" />Resident priority</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Resident students are our deepest studio commitment. We prioritize this schedule, so booking early gives you the best chance at a calm, consistent rhythm.</p>
              </div>
              {manualTimes && selectedEntries.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Selected days</p>
                  <div className="max-h-80 space-y-2 overflow-auto pr-1">
                    {selectedEntries.map((day) => (
                      <div key={day.dateKey} className="grid grid-cols-[1fr_150px] gap-2 rounded-md border border-border p-2">
                        <span className="text-sm font-medium text-foreground">{parseDateKey(day.dateKey).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                        <Select value={day.timeLabel} onValueChange={(value) => updateSelectedTime(day.dateKey, value)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {orderedSlotsForDate(day.dateKey).map((slot) => {
                              const slotAvailability = getSlotAvailability(day.dateKey, slot)
                              return <SelectItem key={slot.timeLabel} value={slot.timeLabel} disabled={slotAvailability.availableSeats <= 0}>{formatStartTime(slot.timeLabel)} · {slotAvailability.availableSeats}/{slotAvailability.maxParticipants}</SelectItem>
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-md border border-border p-4 text-sm">
                <div className="flex items-center justify-between text-muted-foreground"><span>{program.title}</span><span>{formatPrice(program.price)}</span></div>
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground"><span>Total due today</span><span>{formatPrice(program.price)}</span></div>
              </div>
              {!canContinue && <p className="text-sm text-muted-foreground">Select exactly {requiredDays} days, with up to 5 days in each week, to continue to payment.</p>}
              <Button asChild className="h-12 w-full gap-2 text-base" disabled={!canContinue || loading}>
                <Link href={checkoutHref} className={cn(!canContinue && "pointer-events-none opacity-50")}><CalendarDays className="h-4 w-4" />Book Residency</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </section>

      <BrandClosingSection eyebrow="After booking" title="Want to adjust the rhythm? Message us right away." body="Book the residency dates that are closest to your ideal schedule, then contact us on WhatsApp immediately if you need to fine-tune timing, focus, accommodation questions, or studio expectations." />
      <Footer />
    </main>
  )
}
