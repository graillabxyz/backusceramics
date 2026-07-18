"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MobileStickyCta } from "@/components/mobile-sticky-cta"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"
import { formatPrice, workshops } from "@/lib/classes-data"
import {
  addDays,
  CalendarAvailability,
  CalendarSession,
  formatDateKey,
  getScheduleOffering,
  parseDateKey,
  shortDayNames,
  startOfWeek,
} from "@/lib/class-schedule"
import { cn } from "@/lib/utils"
import { trackAnalyticsEvent } from "@/lib/client-analytics"

const classColors: Record<string, string> = {
  "beginner-wheel": "border-l-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100",
  handbuilding: "border-l-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100",
  "3-day-workshop": "border-l-sky-500 bg-sky-50 text-sky-950 dark:bg-sky-950/30 dark:text-sky-100",
  "6-day-workshop": "border-l-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-100",
  "kids-workshop": "border-l-violet-500 bg-violet-50 text-violet-950 dark:bg-violet-950/30 dark:text-violet-100",
}

interface ClassesCalendarProps {
  initialClass?: string
}

type CalendarFilter = "all" | "wheel" | "handbuilding" | "kids" | "multi-day" | "events"

interface ProgramMeeting {
  key: string
  dateKey: string
  date: Date
  timeLabel: string
}

interface WorkshopSequenceDay {
  date: Date
  dateKey: string
  session?: CalendarSession
  available: boolean
  reason?: string
}

interface WorkshopSequence {
  startSession?: CalendarSession
  days: WorkshopSequenceDay[]
  isComplete: boolean
  hasUnavailableDays: boolean
  hasNonSuccessiveDays: boolean
  clayGapBlocked: boolean
  warning?: string
  blocker?: string
}

const multiDayWorkshopIds = ["3-day-workshop", "6-day-workshop"]
const requiredMultiDaySelections: Record<string, number> = {
  "3-day-workshop": 3,
  "6-day-workshop": 6,
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function getSessionFilter(session: CalendarSession): CalendarFilter {
  if (session.scheduleCategory === "event") return "events"
  if (session.scheduleCategory === "multi-week" || session.scheduleCategory === "multi_week") return "multi-day"
  if (session.scheduleCategory === "multi-day") return "multi-day"
  if (session.workshop.id === "beginner-wheel") return "wheel"
  if (session.workshop.id === "handbuilding") return "handbuilding"
  if (session.workshop.id === "kids-workshop") return "kids"
  if (session.workshop.id === "3-day-workshop" || session.workshop.id === "6-day-workshop") return "multi-day"
  if (session.workshop.id === "birthday-event" || session.workshop.id === "private-atelier") return "events"
  return "all"
}

function isMultiDayWorkshop(session?: CalendarSession) {
  return Boolean(session && multiDayWorkshopIds.includes(session.workshop.id))
}

const filterLabels: Record<CalendarFilter, string> = {
  all: "All",
  wheel: "Wheel",
  handbuilding: "Handbuilding",
  kids: "Kids",
  "multi-day": "3 & 6 Day",
  events: "Events",
}

const bookingTypeCards: Array<{
  filter: CalendarFilter
  title: string
}> = [
  {
    filter: "all",
    title: "All Classes",
  },
  {
    filter: "wheel",
    title: "Wheel",
  },
  {
    filter: "handbuilding",
    title: "Handbuilding",
  },
  {
    filter: "kids",
    title: "Kids & Family",
  },
  {
    filter: "multi-day",
    title: "3 & 6 Day",
  },
  {
    filter: "events",
    title: "Private Events",
  },
]

function isPrepaidProgram(session?: CalendarSession) {
  if (!session) return false
  return (
    getSessionFilter(session) === "multi-day" ||
    session.scheduleCategory === "multi-week" ||
    session.scheduleCategory === "multi_week" ||
    session.workshop.id.includes("week")
  )
}

function isWorkshopDay(date: Date) {
  return date.getDay() !== 0
}

function daysBetween(first: Date, second: Date) {
  const dayMs = 24 * 60 * 60 * 1000
  const start = new Date(first)
  const end = new Date(second)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - start.getTime()) / dayMs)
}

function isSameOrAfter(first: Date, second: Date) {
  const a = new Date(first)
  const b = new Date(second)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return a >= b
}

function activeWeekStart(date: Date) {
  const weekStart = startOfWeek(date)
  return date.getDay() === 0 ? addDays(weekStart, 7) : weekStart
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

export function ClassesCalendar({ initialClass }: ClassesCalendarProps) {
  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])
  const [weekStart, setWeekStart] = useState(() => activeWeekStart(today))
  const [sessions, setSessions] = useState<CalendarSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState("")
  const [selectedMultiDayWorkshopId, setSelectedMultiDayWorkshopId] = useState("3-day-workshop")
  const [activeFilter, setActiveFilter] = useState<CalendarFilter>("all")
  const [availability, setAvailability] = useState<Record<string, CalendarAvailability>>({})
  const [availabilityLoading, setAvailabilityLoading] = useState(true)
  const [availabilityError, setAvailabilityError] = useState("")
  const [availabilityReload, setAvailabilityReload] = useState(0)
  const [success, setSuccess] = useState("")
  const bookingSummaryRef = useRef<HTMLElement | null>(null)
  const { isAuthenticated, isLoading: authLoading, openAuthModal } = useAuth()

  const currentWeekStart = useMemo(() => activeWeekStart(today), [today])
  const displayedWeekStarts = useMemo(() => [weekStart, addDays(weekStart, 7)], [weekStart])
  const studioDays = useMemo(
    () => displayedWeekStarts.flatMap((displayedWeekStart) =>
      Array.from({ length: 6 }, (_, index) => addDays(displayedWeekStart, index))
    ),
    [displayedWeekStarts]
  )
  const visibleStudioDays = useMemo(() => studioDays.filter((date) => isSameOrAfter(date, today)), [studioDays, today])
  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${addDays(weekStart, 13).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
  const weekSessions = useMemo(() => {
    const weekKeys = new Set(visibleStudioDays.map(formatDateKey))
    return sessions.filter((session) => weekKeys.has(session.dateKey))
  }, [sessions, visibleStudioDays])
  const visibleSessions = useMemo(() => {
    return activeFilter === "all"
      ? weekSessions
      : weekSessions.filter((session) => getSessionFilter(session) === activeFilter)
  }, [activeFilter, weekSessions])
  const selectedVisibleSession = visibleSessions.find((session) => session.id === selectedSessionId) || visibleSessions[0]
  const activeSession = selectedVisibleSession
  const selectedMultiDayWorkshop = workshops.find((workshop) => workshop.id === selectedMultiDayWorkshopId)
  const selectedMultiDaySession = activeSession && isMultiDayWorkshop(activeSession)
    ? sessions.find(
        (session) =>
          session.workshop.id === selectedMultiDayWorkshopId &&
          session.dateKey === activeSession.dateKey &&
          session.timeLabel === activeSession.timeLabel
      ) || activeSession
    : null
  const activeCheckoutSession = selectedMultiDaySession || activeSession
  const activeWorkshop = selectedMultiDaySession ? selectedMultiDayWorkshop || selectedMultiDaySession.workshop : activeSession?.workshop
  const activeMaxParticipants = activeSession?.maxParticipants ?? activeSession?.workshop.maxParticipants ?? 8
  const selectedAvailability = activeSession ? availability[activeSession.id] : undefined
  const activeAvailableSeats = selectedAvailability?.availableSeats ?? activeMaxParticipants
  const isMultiDaySelection = isMultiDayWorkshop(activeSession)
  const requiredProgramDays = isMultiDaySelection ? requiredMultiDaySelections[selectedMultiDayWorkshopId] || 0 : 0
  const prepaidProgram = isMultiDaySelection || isPrepaidProgram(activeSession)
  const filterCounts = useMemo(() => {
    const counts: Record<CalendarFilter, number> = {
      all: 0,
      wheel: 0,
      handbuilding: 0,
      kids: 0,
      "multi-day": 0,
      events: 0,
    }
    const countedTimes = new Set<string>()

    weekSessions.forEach((session) => {
      const seatsAvailable = availability[session.id]?.availableSeats
        ?? session.maxParticipants
        ?? session.workshop.maxParticipants
        ?? 0
      if (seatsAvailable <= 0) return

      const sessionKey = isMultiDayWorkshop(session)
        ? `multi-day|${session.dateKey}|${session.timeLabel}`
        : session.id
      if (countedTimes.has(sessionKey)) return

      countedTimes.add(sessionKey)
      counts.all += 1
      counts[getSessionFilter(session)] += 1
    })

    return counts
  }, [availability, weekSessions])
  const buildSequenceForSession = (startSession: CalendarSession, workshopId: string): WorkshopSequence => {
    const requiredDays = requiredMultiDaySelections[workshopId] || 0
    const sequenceDays: WorkshopSequenceDay[] = []
    let cursor = new Date(startSession.date)

    while (sequenceDays.length < requiredDays) {
      if (!isWorkshopDay(cursor)) {
        cursor = addDays(cursor, 1)
        continue
      }

      const dateKey = formatDateKey(cursor)
      const matchingSession = sessions.find(
        (session) =>
          session.workshop.id === workshopId &&
          session.dateKey === dateKey &&
          session.timeLabel === startSession.timeLabel
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
        reason: available ? undefined : "This selected time slot is already fully booked or unavailable.",
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
      isComplete: sequenceDays.length === requiredDays && !hasUnavailableDays && !clayGapBlocked,
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
  const selectedSequence = isMultiDaySelection && selectedMultiDaySession
    ? buildSequenceForSession(selectedMultiDaySession, selectedMultiDayWorkshopId)
    : null
  const activeSelectedSessions = selectedSequence?.days.flatMap((day) => (day.session ? [day.session] : [])) || []
  const programAvailableSeats = activeSelectedSessions.length > 0
    ? Math.min(
        ...activeSelectedSessions.map((session) =>
          availability[session.id]?.availableSeats ?? session.maxParticipants ?? session.workshop.maxParticipants ?? 1
        )
      )
    : 0
  const purchasableSeats = isMultiDaySelection ? programAvailableSeats : activeAvailableSeats
  const programMeetingOptions = useMemo<ProgramMeeting[]>(() => {
    if (isMultiDaySelection) {
      return selectedSequence?.days.flatMap((day) =>
        day.session
          ? [{
              key: `${day.session.dateKey}|${day.session.timeLabel}`,
              dateKey: day.session.dateKey,
              date: day.session.date,
              timeLabel: day.session.timeLabel,
            }]
          : []
      ) || []
    }

    if (!activeSession || !prepaidProgram) return []

    const startDate = activeSession.scheduleStartDate || activeSession.date
    const endDate = activeSession.scheduleEndDate || activeSession.date
    const weekdays = activeSession.scheduleWeekdays
    const meetings: ProgramMeeting[] = []
    let date = new Date(startDate)

    while (date <= endDate) {
      if (!weekdays || weekdays.length === 0 || weekdays.includes(date.getDay())) {
        const dateKey = formatDateKey(date)
        meetings.push({
          key: `${dateKey}|${activeSession.timeLabel}`,
          dateKey,
          date: new Date(date),
          timeLabel: activeSession.timeLabel,
        })
      }
      date = addDays(date, 1)
    }

    return meetings
  }, [activeSession, isMultiDaySelection, prepaidProgram, selectedSequence])

  useEffect(() => {
    let ignore = false

    async function loadAvailability() {
      const requestedClass = initialClass || new URLSearchParams(window.location.search).get("class") || undefined
      setAvailabilityLoading(true)
      setAvailabilityError("")
      try {
        const responses = await Promise.all([
          fetch(`/api/classes/availability?weekStart=${formatDateKey(weekStart)}`),
          fetch(`/api/classes/availability?weekStart=${formatDateKey(addDays(weekStart, 7))}`),
          fetch(`/api/classes/availability?weekStart=${formatDateKey(addDays(weekStart, 14))}`),
        ])
        const failedResponse = responses.find((res) => !res.ok)
        if (failedResponse) {
          const errorBody = await failedResponse.json().catch(() => ({}))
          throw new Error(errorBody.error || "Could not load availability")
        }
        const weeks = await Promise.all(responses.map((res) => res.json()))
        if (ignore) return

        const nextAvailability = Object.fromEntries(
          weeks.flatMap((data) => data.availability as CalendarAvailability[]).map((item) => [item.sessionId, item])
        )
        const nextSessions = weeks.flatMap((data) => data.sessions || [])
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
            if (!offering) return null
            const date = parseDateKey(session.dateKey)
            return {
              id: session.id,
              scheduleId: session.scheduleId,
              workshop: offering,
              date,
              dateKey: session.dateKey,
              timeLabel: session.timeLabel,
              scheduleLabel: session.category,
              sortHour: Number.parseInt(session.timeLabel, 10) || 0,
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
        const currentWeekKeys = new Set(
          Array.from({ length: 13 }, (_, index) => addDays(weekStart, index))
            .filter((date) => isSameOrAfter(date, today))
            .map(formatDateKey)
        )
        const nextWeekSessions = nextSessions.filter((session) => currentWeekKeys.has(session.dateKey))

        setSelectedSessionId((current) => {
          if (nextWeekSessions.some((session) => session.id === current)) return current
          return nextWeekSessions.find((session) => session.workshop.slug === requestedClass || session.workshop.id === requestedClass)?.id || nextWeekSessions[0]?.id || ""
        })
      } catch (error) {
        console.error("Failed to load weekly class availability", error)
        if (!ignore) {
          setSessions([])
          setAvailability({})
          setAvailabilityError("We could not check live class availability. Your dates may still be open. Please try again.")
        }
      } finally {
        if (!ignore) setAvailabilityLoading(false)
      }
    }

    loadAvailability()
    return () => {
      ignore = true
    }
  }, [availabilityReload, initialClass, today, weekStart])

  useEffect(() => {
    if (visibleSessions.length > 0 && !visibleSessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(visibleSessions[0].id)
    }
  }, [selectedSessionId, visibleSessions])

  const moveWeek = (weeks: number) => {
    const nextWeek = addDays(weekStart, weeks * 7)
    setWeekStart(nextWeek < currentWeekStart ? currentWeekStart : nextWeek)
    setSuccess("")
  }

  const goToThisWeek = () => {
    const nextWeek = activeWeekStart(today)
    setWeekStart(nextWeek)
    setSuccess("")
  }

  const scrollToBookingSummary = () => {
    if (typeof window === "undefined") return
    if (!window.matchMedia("(max-width: 1279px)").matches) return

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        bookingSummaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    })
  }

  const handleSelectSession = (session: CalendarSession) => {
    setSelectedSessionId(session.id)
    setSuccess("")
    scrollToBookingSummary()
  }

  const buildCheckoutHref = () => {
    if (!activeCheckoutSession || !activeWorkshop) return "/classes/calendar"
    const params = new URLSearchParams({
      workshopId: activeWorkshop.id,
      title: activeCheckoutSession.scheduleTitle || activeWorkshop.title,
      dateKey: formatDateKey(activeCheckoutSession.date),
      dateLabel: isMultiDaySelection ? `${programMeetingOptions.length} selected days` : formatLongDate(activeCheckoutSession.date),
      timeLabel: isMultiDaySelection ? "Selected program days" : activeCheckoutSession.timeLabel,
      price: String(activeWorkshop.price),
      maxSeats: String(purchasableSeats),
      prepaid: prepaidProgram ? "true" : "false",
      returnTo: "/classes/calendar",
      returnLabel: "Back to weekly calendar",
      source: "weekly-calendar",
    })

    if (isMultiDaySelection) params.set("requiredMeetings", String(requiredProgramDays))
    if (activeCheckoutSession.scheduleId) params.set("scheduleId", activeCheckoutSession.scheduleId)
    if (prepaidProgram) {
      params.set("meetings", JSON.stringify(programMeetingOptions.map((meeting) => ({
        key: meeting.key,
        dateKey: meeting.dateKey,
        dateLabel: meeting.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
        timeLabel: meeting.timeLabel,
      }))))
    }

    return `/classes/checkout?${params.toString()}`
  }

  const handleUnauthenticatedCheckout = () => {
    if (!isAuthenticated && !authLoading) {
      trackCheckoutIntent()
      openAuthModal(buildCheckoutHref())
    }
  }
  const trackCheckoutIntent = () => {
    if (!activeCheckoutSession || !activeWorkshop) return
    void trackAnalyticsEvent({
      type: "checkout_intent_click",
      path: buildCheckoutHref(),
      source: "weekly-calendar",
      workshopId: activeWorkshop.id,
      workshopTitle: activeCheckoutSession.scheduleTitle || activeWorkshop.title,
      scheduleId: activeCheckoutSession.scheduleId || undefined,
      value: activeWorkshop.price,
      metadata: {
        selectedDateKey: activeCheckoutSession.dateKey,
        selectedTime: activeCheckoutSession.timeLabel,
        prepaid: prepaidProgram,
        requiredDays: requiredProgramDays,
      },
    })
  }
  const isCheckingSignIn = authLoading && !isAuthenticated
  const canContinue = isMultiDaySelection
    ? Boolean(selectedSequence?.isComplete && purchasableSeats > 0)
    : Boolean(activeSession && purchasableSeats > 0)

  const renderSessionButton = (session: CalendarSession) => {
    const seats = availability[session.id]
    const seatsAvailable = seats?.availableSeats ?? session.workshop.maxParticipants ?? 8
    const isFull = seatsAvailable <= 0
    const isCombinedMultiDay = isMultiDayWorkshop(session)
    const buttonTitle = isCombinedMultiDay ? "3 or 6 Day Workshop" : session.scheduleTitle || session.workshop.title

    return (
      <button
        key={session.id}
        type="button"
        onClick={() => handleSelectSession(session)}
        className={cn(
          "w-full rounded-md border border-border border-l-4 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isCombinedMultiDay ? "border-l-sky-500 bg-sky-50 text-sky-950 dark:bg-sky-950/30 dark:text-sky-100" : classColors[session.workshop.id] || "border-l-primary bg-muted text-foreground",
          activeSession?.id === session.id && "ring-2 ring-primary",
          isFull && "opacity-60"
        )}
      >
        <span className="block text-xs font-semibold">{session.timeLabel}</span>
        <span className="mt-1 block text-sm font-semibold leading-tight">{buttonTitle}</span>
        <span className="mt-2 flex items-center justify-between gap-2 text-xs opacity-80">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {availabilityLoading ? "Checking" : isFull ? "Full" : `${seatsAvailable} left`}
          </span>
          {seats && seats.heldSeats > 0 && (
            <span>{seats.heldSeats} held</span>
          )}
        </span>
      </button>
    )
  }

  const renderDayCard = (date: Date) => {
    const isToday = formatDateKey(date) === formatDateKey(today)
    const daySessions = Array.from(
      visibleSessions
        .filter((session) => session.dateKey === formatDateKey(date))
        .reduce((groupedSessions, session) => {
          const key = isMultiDayWorkshop(session) ? `multi-day|${session.dateKey}|${session.timeLabel}` : session.id
          if (!groupedSessions.has(key) || session.workshop.id === "3-day-workshop") {
            groupedSessions.set(key, session)
          }
          return groupedSessions
        }, new Map<string, CalendarSession>())
        .values()
    )

    return (
      <div key={date.toISOString()} className="min-h-[180px] rounded-lg border border-border bg-background p-3 shadow-sm sm:p-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">{shortDayNames[date.getDay()]}</p>
            <p className="mt-1 text-sm text-muted-foreground">{date.toLocaleDateString("en-US", { month: "long" })}</p>
          </div>
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold", isToday && "bg-primary text-primary-foreground")}>
            {date.getDate()}
          </span>
        </div>
        <div className="mt-3 space-y-2.5">
          {daySessions.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No sessions
            </div>
          ) : (
            daySessions.map(renderSessionButton)
          )}
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background pb-28 lg:pb-0">
      <section className="border-b border-border bg-secondary/25 pt-24 pb-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" asChild className="mb-4 px-0">
            <Link href="/classes">
              <ArrowLeft className="h-4 w-4" />
              Class guide
            </Link>
          </Button>
          <div className="max-w-2xl">
            <Badge variant="secondary" className="mb-3">Class Calendar</Badge>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Find your class.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Browse two weeks at a glance, choose a class type, then pick the date and time that suits you.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 xl:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="xl:col-span-2">
          <div className="mb-4 rounded-lg border border-border bg-card/70 p-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="lg:min-w-64">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Class type</p>
                <h2 className="mt-1 font-heading text-lg font-bold text-foreground">What would you like to book?</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-end">
                {bookingTypeCards.map((option) => {
                  const isActive = activeFilter === option.filter
                  const hasAvailability = filterCounts[option.filter] > 0

                  return (
                    <button
                      key={option.filter}
                      type="button"
                      onClick={() => {
                        setActiveFilter(option.filter)
                        setSuccess("")
                      }}
                      className={cn(
                        "rounded-md border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-background text-foreground hover:border-primary/60 hover:bg-muted/35",
                        !hasAvailability && !isActive && "text-muted-foreground"
                      )}
                    >
                      <span className="block leading-tight">{option.title}</span>
                      <span className={cn("mt-0.5 block text-[11px] font-medium", isActive ? "text-primary-foreground/80" : hasAvailability ? "text-primary" : "text-muted-foreground")}>
                        {hasAvailability ? `${filterCounts[option.filter]} ${filterCounts[option.filter] === 1 ? "time" : "times"}` : "No times"}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        {availabilityError ? (
          <div className="xl:col-span-2 flex min-h-72 flex-col items-center justify-center rounded-lg border border-border bg-card px-6 py-12 text-center shadow-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </span>
            <p className="mt-4 font-semibold text-foreground">Live availability is temporarily unavailable</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{availabilityError}</p>
            <Button type="button" variant="outline" className="mt-5" onClick={() => setAvailabilityReload((value) => value + 1)}>
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        ) : (
          <>
        <div>
          <div className="mb-5 flex flex-col gap-3 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Upcoming availability</p>
              <h2 className="mt-1 font-heading text-xl font-bold text-foreground">Two weeks at a glance</h2>
            </div>
            <div className="flex w-full items-center rounded-md border border-border bg-background p-1 sm:w-auto">
              <Button variant="ghost" size="icon" onClick={() => moveWeek(-1)} disabled={weekStart <= currentWeekStart} aria-label="Show the previous week">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1 px-2 text-center text-sm font-medium text-foreground sm:min-w-52 sm:px-3">{weekLabel}</div>
              <Button variant="ghost" size="icon" onClick={() => moveWeek(1)} aria-label="Show the next week">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToThisWeek}>
                Today
              </Button>
            </div>
          </div>

          <div className="space-y-8">
            {displayedWeekStarts.map((displayedWeekStart, weekIndex) => {
              const displayedDays = Array.from({ length: 6 }, (_, index) => addDays(displayedWeekStart, index))
                .filter((date) => isSameOrAfter(date, today))
              if (displayedDays.length === 0) return null

              return (
                <section key={formatDateKey(displayedWeekStart)} aria-labelledby={`calendar-week-${formatDateKey(displayedWeekStart)}`}>
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 id={`calendar-week-${formatDateKey(displayedWeekStart)}`} className="font-heading text-lg font-bold text-foreground">
                      {weekIndex === 0 && displayedWeekStart.getTime() === currentWeekStart.getTime()
                        ? "This week"
                        : weekIndex === 1 && weekStart.getTime() === currentWeekStart.getTime()
                          ? "Next week"
                          : `Week of ${displayedWeekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {displayedWeekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {addDays(displayedWeekStart, 5).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {displayedDays.map(renderDayCard)}
                  </div>
                </section>
              )
            })}
          </div>
        </div>

        <aside ref={bookingSummaryRef} className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
          {activeSession ? (
            <Card className="overflow-hidden border-border shadow-sm">
              {activeSession.workshop.image && (
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  <img
                    src={activeSession.workshop.image}
                    alt={activeSession.workshop.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <CardContent className="space-y-5 p-6">
                <div>
                  <Badge variant="outline">{activeSession.workshop.level}</Badge>
                  <h2 className="mt-3 font-heading text-2xl font-bold text-foreground">
                    {isMultiDaySelection ? selectedMultiDayWorkshop?.title || "3 Days Workshop" : activeSession.scheduleTitle || activeSession.workshop.title}
                  </h2>
                  <p className="mt-1 text-sm font-medium uppercase tracking-wide text-primary">
                    {isMultiDaySelection ? "Workshop sequence" : activeSession.workshop.subtitle}
                  </p>
                </div>

                {isMultiDaySelection && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">Choose workshop length</p>
                    <Select value={selectedMultiDayWorkshopId} onValueChange={setSelectedMultiDayWorkshopId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3-day-workshop">3 Day Workshop</SelectItem>
                        <SelectItem value="6-day-workshop">6 Day Workshop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-muted/60 p-3">
                    <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Date
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {isMultiDaySelection ? `${selectedSequence?.days.filter((day) => day.available).length || 0} of ${requiredProgramDays} days available` : formatLongDate(activeSession.date)}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/60 p-3">
                    <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Time
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {isMultiDaySelection ? `${formatStartTime(activeSession.timeLabel)} start` : activeSession.timeLabel}
                    </p>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-muted-foreground">
                  {isMultiDaySelection
                    ? "Choose your starting time. We will show the full workshop commitment for the selected program before checkout."
                    : activeSession.workshop.description}
                </p>

                {isMultiDaySelection && selectedSequence && (
                  <div className="space-y-2 rounded-md border border-border p-3">
                    {selectedSequence.days.map((day) => (
                      <div key={day.dateKey} className="flex items-center justify-between gap-3 text-sm">
                        <span className={cn("text-muted-foreground", !day.available && "text-foreground")}>
                          {day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          {" · "}
                          {day.session?.timeLabel || activeSession.timeLabel}
                        </span>
                        <span className={cn("text-xs font-medium", day.available ? "text-success" : "text-accent")}>
                          {day.available ? "Available" : "Unavailable"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {selectedSequence?.warning && (
                  <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-sm leading-relaxed text-foreground">
                    {selectedSequence.warning}
                  </div>
                )}

                {selectedSequence?.blocker && (
                  <div className="rounded-md border border-accent/50 bg-accent/10 p-3 text-sm leading-relaxed text-foreground">
                    {selectedSequence.blocker}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Price</p>
                    <p className="font-semibold text-foreground">{formatPrice(activeWorkshop?.price || activeSession.workshop.price)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Seats</p>
                    <p className="font-semibold text-foreground">
                      {availabilityLoading
                        ? "Checking..."
                        : `${purchasableSeats} of ${activeMaxParticipants} available`}
                    </p>
                    {selectedAvailability && selectedAvailability.heldSeats > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedAvailability.heldSeats} held for resident schedule
                      </p>
                    )}
                  </div>
                </div>

                {success && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{success}</p>}

                {isAuthenticated ? (
                  <Button
                    asChild
                    className="hidden h-12 w-full gap-2 text-base lg:inline-flex"
                    disabled={!canContinue || availabilityLoading}
                  >
                    <Link
                      href={buildCheckoutHref()}
                      className={cn((!canContinue || availabilityLoading) && "pointer-events-none opacity-50")}
                      onClick={trackCheckoutIntent}
                    >
                      <CalendarDays className="h-4 w-4" />
                      {!canContinue ? "Choose another start time" : "Continue to Payment"}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    onClick={handleUnauthenticatedCheckout}
                    className="hidden h-12 w-full gap-2 text-base lg:inline-flex"
                    disabled={!canContinue || availabilityLoading || isCheckingSignIn}
                  >
                    {isCheckingSignIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                    {!canContinue ? "Choose another start time" : isCheckingSignIn ? "Checking sign-in..." : "Sign in to Pay"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border shadow-sm">
              <CardContent className="p-6">
                <Badge variant="outline">No sessions</Badge>
                <h2 className="mt-3 font-heading text-2xl font-bold text-foreground">
                  {activeFilter === "all" ? "No sessions in these two weeks" : `No ${filterLabels[activeFilter].toLowerCase()} sessions in these two weeks`}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Try another class type or show later dates to see more availability.
                </p>
                <Button type="button" variant="outline" className="mt-5 w-full" onClick={() => moveWeek(1)}>
                  Show later dates
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </aside>
          </>
        )}
      </section>

      {activeSession && (
        <MobileStickyCta
          title={isMultiDaySelection ? selectedMultiDayWorkshop?.title || "Workshop sequence" : activeSession.scheduleTitle || activeSession.workshop.title}
          detail={
            isMultiDaySelection
              ? `${selectedSequence?.days.filter((day) => day.available).length || 0} of ${requiredProgramDays} days available`
              : `${formatLongDate(activeSession.date)} · ${activeSession.timeLabel}`
          }
        >
          {isAuthenticated ? (
            <Button
              asChild
              className="h-11 px-4 text-sm"
              disabled={!canContinue || availabilityLoading}
            >
              <Link
                href={buildCheckoutHref()}
                className={cn((!canContinue || availabilityLoading) && "pointer-events-none opacity-50")}
                onClick={trackCheckoutIntent}
              >
                {!canContinue ? "Change time" : "Pay"}
              </Link>
            </Button>
          ) : (
            <Button
              onClick={handleUnauthenticatedCheckout}
              className="h-11 px-4 text-sm"
              disabled={!canContinue || availabilityLoading || isCheckingSignIn}
            >
              {isCheckingSignIn ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {!canContinue ? "Change time" : isCheckingSignIn ? "Checking" : "Sign in"}
            </Button>
          )}
        </MobileStickyCta>
      )}

    </main>
  )
}
