"use client"

import { useState, useEffect, useMemo } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Archive, CalendarDays, CalendarPlus, CheckCircle2, CircleDashed, Clock, GraduationCap, Loader2, Pencil, Trash2, Users } from "lucide-react"
import { dayNames, parseDateKey, parseScheduleDays, parseTimeHour, parseTimeLabel, scheduleOfferings } from "@/lib/class-schedule"

interface Booking {
  id: string
  workshopId: string
  status: string
  contactName: string
  contactEmail: string
  contactPhone: string | null
  preferredDate: string | null
  participants: number
  notes: string | null
  cancelledAt?: string | null
  archivedAt?: string | null
  createdAt: string
}

interface ClassHold {
  id: string
  studentName: string
  studentEmail: string | null
  workshopId: string
  timeLabel: string
  seats: number
  weekdays: string
  startDate: string
  endDate: string | null
  notes: string | null
  status: string
}

interface ClassSchedule {
  id: string
  offeringId: string
  title: string
  category: string
  timeLabel: string
  startDate: string
  endDate: string | null
  weekdays: string | null
  maxParticipants: number
  notes: string | null
  status: string
}

interface AvailabilityHoldDetail {
  id: string
  studentName: string
  seats: number
}

interface AvailabilityRow {
  sessionId: string
  scheduleId?: string
  workshopId: string
  title: string
  category: string
  dateKey: string
  timeLabel: string
  maxParticipants: number
  bookedSeats: number
  heldSeats: number
  availableSeats: number
  holds: AvailabilityHoldDetail[]
}

const classOptions = scheduleOfferings.filter((workshop) => workshop.available)

const initialHoldForm = {
  studentName: "",
  studentEmail: "",
  workshopId: "beginner-wheel",
  timeLabel: "10:00 - 12:00 PM",
  seats: "1",
  weekdays: ["1"],
  startDate: "",
  endDate: "",
  notes: "",
  allowCustomTime: false,
}

const initialScheduleForm = {
  offeringId: "beginner-wheel",
  title: "",
  category: "weekly-class",
  timeLabel: "10:00 - 12:00 PM",
  maxParticipants: "3",
  startDate: "",
  endDate: "",
  weekdays: ["1", "2", "3", "4", "5"],
  notes: "",
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-gray-100 text-gray-800",
  ARCHIVED: "bg-stone-200 text-stone-800",
}

const statusOptions = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "ARCHIVED"]

function parseWeekdayList(value: string | null) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((day): day is number => typeof day === "number") : []
  } catch {
    return []
  }
}

function formatDate(value: string | null) {
  if (!value) return "Ongoing"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function inputDateValue(value: string | null) {
  if (!value) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toLocaleDateString("en-CA")
}

function formatDateRange(startDate: string, endDate: string | null) {
  return `${formatDate(startDate)} - ${endDate ? formatDate(endDate) : "ongoing"}`
}

function weekdayLabel(days: number[]) {
  if (days.length === 0) return "Single date"
  return days.map((day) => dayNames[day]?.slice(0, 3) || day).join(", ")
}

function monthStartKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`
}

function shiftMonth(monthStart: string, offset: number) {
  const date = parseDateKey(monthStart)
  date.setMonth(date.getMonth() + offset)
  return monthStartKey(date)
}

function dateKeyWeekday(dateKey: string) {
  const date = parseDateKey(dateKey)
  return Number.isNaN(date.getTime()) ? new Date().getDay() : date.getDay()
}

function isCustomHoldSlot(workshopId: string, timeLabel: string, weekdays: number[]) {
  const workshop = classOptions.find((item) => item.id === workshopId)
  if (!workshop) return true

  const validTimes = (workshop.schedule || []).map(parseTimeLabel)
  const validWeekdays = new Set((workshop.schedule || []).flatMap(parseScheduleDays))

  return (
    (validTimes.length > 0 && !validTimes.includes(timeLabel)) ||
    (validWeekdays.size > 0 && weekdays.some((day) => !validWeekdays.has(day)))
  )
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [archivedBookings, setArchivedBookings] = useState<Booking[]>([])
  const [holds, setHolds] = useState<ClassHold[]>([])
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [availabilityMonth, setAvailabilityMonth] = useState(() => monthStartKey())
  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>([])
  const [holdForm, setHoldForm] = useState(initialHoldForm)
  const [scheduleForm, setScheduleForm] = useState(initialScheduleForm)
  const [editingHoldId, setEditingHoldId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("requests")
  const [holdAccordionValue, setHoldAccordionValue] = useState("")
  const [loading, setLoading] = useState(true)
  const [availabilityLoading, setAvailabilityLoading] = useState(true)
  const [savingHold, setSavingHold] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [holdError, setHoldError] = useState("")
  const [scheduleError, setScheduleError] = useState("")
  const [availabilityError, setAvailabilityError] = useState("")

  const selectedWorkshop = classOptions.find((workshop) => workshop.id === holdForm.workshopId) || classOptions[0]
  const selectedTimes = selectedWorkshop.schedule?.map(parseTimeLabel) || []
  const selectedWeekdays = Array.from(new Set(selectedWorkshop.schedule?.flatMap(parseScheduleDays) || []))
  const allWeekdayChoices = [1, 2, 3, 4, 5, 6, 0]
  const holdWeekdayChoices = holdForm.allowCustomTime
    ? allWeekdayChoices
    : selectedWeekdays.length > 0 ? selectedWeekdays : allWeekdayChoices
  const allKnownTimeLabels = useMemo(() => {
    const labels = new Set<string>()
    for (const workshop of classOptions) {
      for (const schedule of workshop.schedule || []) labels.add(parseTimeLabel(schedule))
    }
    for (const schedule of schedules) labels.add(schedule.timeLabel)
    if (holdForm.timeLabel) labels.add(holdForm.timeLabel)
    return Array.from(labels).sort((a, b) => parseTimeHour(a) - parseTimeHour(b) || a.localeCompare(b))
  }, [schedules, holdForm.timeLabel])
  const maxSeats = selectedWorkshop.maxParticipants ?? 8
  const selectedScheduleOffering = classOptions.find((offering) => offering.id === scheduleForm.offeringId) || classOptions[0]
  const isRecurringSchedule = scheduleForm.category === "weekly-class"
  const pendingBookings = bookings.filter((booking) => booking.status === "PENDING")
  const confirmedBookings = bookings.filter((booking) => booking.status === "CONFIRMED")
  const recentCancelledBookings = bookings.filter((booking) => booking.status === "CANCELLED")
  const activeSchedules = schedules.filter((schedule) => schedule.status !== "CANCELLED")
  const activeHolds = holds.filter((hold) => hold.status === "ACTIVE")
  const heldSeats = activeHolds.reduce((total, hold) => total + hold.seats, 0)
  const availabilityByDate = useMemo(() => {
    return availabilityRows.reduce<Record<string, AvailabilityRow[]>>((groups, row) => {
      groups[row.dateKey] = [...(groups[row.dateKey] || []), row]
      return groups
    }, {})
  }, [availabilityRows])
  const availabilityTotals = useMemo(() => {
    const uniquePools = new Map<string, AvailabilityRow>()
    for (const row of availabilityRows) {
      const key = `${row.dateKey}|${row.timeLabel}`
      if (!uniquePools.has(key)) uniquePools.set(key, row)
    }

    return Array.from(uniquePools.values()).reduce(
      (totals, row) => ({
        booked: totals.booked + row.bookedSeats,
        held: totals.held + row.heldSeats,
        open: totals.open + row.availableSeats,
      }),
      { booked: 0, held: 0, open: 0 }
    )
  }, [availabilityRows])
  const availabilityMonthLabel = formatDate(availabilityMonth)

  useEffect(() => {
    fetchBookings()
    fetchArchivedBookings()
    fetchHolds()
    fetchSchedules()
  }, [])

  useEffect(() => {
    fetchAvailability()
  }, [availabilityMonth])

  const fetchBookings = async () => {
    try {
      const res = await fetch("/api/bookings")
      if (res.ok) setBookings(await res.json())
    } catch (err) {
      console.error("Failed to fetch bookings:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchArchivedBookings = async () => {
    try {
      const res = await fetch("/api/bookings?view=archived")
      if (res.ok) setArchivedBookings(await res.json())
    } catch (err) {
      console.error("Failed to fetch archived bookings:", err)
    }
  }

  const fetchHolds = async () => {
    try {
      const res = await fetch("/api/class-holds")
      if (res.ok) setHolds(await res.json())
    } catch (err) {
      console.error("Failed to fetch class holds:", err)
    }
  }

  const fetchSchedules = async () => {
    try {
      const res = await fetch("/api/class-schedules")
      if (res.ok) setSchedules(await res.json())
    } catch (err) {
      console.error("Failed to fetch class schedules:", err)
    }
  }

  const fetchAvailability = async () => {
    setAvailabilityLoading(true)
    setAvailabilityError("")

    try {
      const res = await fetch(`/api/classes/availability?monthStart=${availabilityMonth}&includeHoldDetails=1`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Could not load class availability")
      }
      const data = await res.json()
      setAvailabilityRows(Array.isArray(data.availability) ? data.availability : [])
    } catch (err) {
      console.error("Failed to fetch class availability:", err)
      setAvailabilityError(err instanceof Error ? err.message : "Could not load class availability")
      setAvailabilityRows([])
    } finally {
      setAvailabilityLoading(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        await Promise.all([fetchBookings(), fetchArchivedBookings()])
      }
    } catch (err) {
      console.error("Failed to update booking:", err)
    }
  }

  const resetHoldForm = () => {
    setHoldForm(initialHoldForm)
    setEditingHoldId(null)
    setHoldError("")
  }

  const saveHold = async () => {
    setHoldError("")
    setSavingHold(true)

    try {
      const res = await fetch(editingHoldId ? `/api/class-holds/${editingHoldId}` : "/api/class-holds", {
        method: editingHoldId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...holdForm,
          seats: Number(holdForm.seats),
          weekdays: holdForm.weekdays.map(Number),
          status: "ACTIVE",
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Could not save resident schedule")
      }

      resetHoldForm()
      setHoldAccordionValue("")
      await Promise.all([fetchHolds(), fetchAvailability()])
    } catch (err) {
      setHoldError(err instanceof Error ? err.message : "Could not save resident schedule")
    } finally {
      setSavingHold(false)
    }
  }

  const openEditHold = (hold: ClassHold) => {
    const weekdays = parseWeekdayList(hold.weekdays)
    setHoldForm({
      studentName: hold.studentName,
      studentEmail: hold.studentEmail || "",
      workshopId: hold.workshopId,
      timeLabel: hold.timeLabel,
      seats: hold.seats.toString(),
      weekdays: weekdays.map(String),
      startDate: inputDateValue(hold.startDate),
      endDate: inputDateValue(hold.endDate),
      notes: hold.notes || "",
      allowCustomTime: isCustomHoldSlot(hold.workshopId, hold.timeLabel, weekdays),
    })
    setEditingHoldId(hold.id)
    setHoldError("")
    setActiveTab("holds")
    setHoldAccordionValue("add-hold")
  }

  const createSchedule = async () => {
    setScheduleError("")
    setSavingSchedule(true)

    try {
      const res = await fetch("/api/class-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...scheduleForm,
          title: scheduleForm.title || selectedScheduleOffering.title,
          maxParticipants: Number(scheduleForm.maxParticipants),
          weekdays: isRecurringSchedule ? scheduleForm.weekdays.map(Number) : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Could not create calendar schedule")
      }

      setScheduleForm(initialScheduleForm)
      await fetchSchedules()
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Could not create calendar schedule")
    } finally {
      setSavingSchedule(false)
    }
  }

  const deleteHold = async (id: string) => {
    try {
      const res = await fetch(`/api/class-holds/${id}`, { method: "DELETE" })
      if (res.ok) {
        setHolds((prev) => prev.filter((hold) => hold.id !== id))
        await fetchAvailability()
      }
    } catch (err) {
      console.error("Failed to delete class hold:", err)
    }
  }

  const deleteSchedule = async (id: string) => {
    try {
      const res = await fetch(`/api/class-schedules/${id}`, { method: "DELETE" })
      if (res.ok) setSchedules((prev) => prev.filter((schedule) => schedule.id !== id))
    } catch (err) {
      console.error("Failed to delete class schedule:", err)
    }
  }

  const toggleWeekday = (day: number) => {
    const value = day.toString()
    setHoldForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(value)
        ? prev.weekdays.filter((item) => item !== value)
        : [...prev.weekdays, value],
    }))
  }

  const toggleScheduleWeekday = (day: number) => {
    const value = day.toString()
    setScheduleForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(value)
        ? prev.weekdays.filter((item) => item !== value)
        : [...prev.weekdays, value],
    }))
  }

  const prefillHoldFromAvailability = (row: AvailabilityRow) => {
    const weekday = dateKeyWeekday(row.dateKey)
    setHoldForm({
      studentName: "WhatsApp / Instagram hold",
      studentEmail: "",
      workshopId: row.workshopId,
      timeLabel: row.timeLabel,
      seats: "1",
      weekdays: [weekday.toString()],
      startDate: row.dateKey,
      endDate: row.dateKey,
      notes: `Manual seat block for ${row.title}. Replace this note with the customer's name and source before saving.`,
      allowCustomTime: true,
    })
    setEditingHoldId(null)
    setHoldError("")
    setActiveTab("holds")
    setHoldAccordionValue("add-hold")
  }

  const renderBookingList = (items: Booking[], emptyTitle: string, emptyDescription: string) => {
    if (items.length === 0) {
      return (
        <div className="py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <GraduationCap className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="mb-2 font-heading text-lg font-bold">{emptyTitle}</CardTitle>
          <CardDescription>{emptyDescription}</CardDescription>
        </div>
      )
    }

    return (
      <div className="divide-y">
        {items.map((booking) => (
          <div key={booking.id} className="grid gap-4 p-4 lg:grid-cols-[1.25fr_1fr_auto] lg:items-center lg:p-5">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-foreground">{booking.contactName}</h3>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[booking.status] || statusColors.PENDING}`}>
                  {booking.status}
                </span>
              </div>
              <p className="truncate text-sm text-muted-foreground">{booking.contactEmail}</p>
              {booking.contactPhone && (
                <p className="text-sm text-muted-foreground">{booking.contactPhone}</p>
              )}
              {booking.status === "CANCELLED" && booking.cancelledAt && (
                <p className="mt-1 text-xs text-muted-foreground">Cancelled {formatDate(booking.cancelledAt)}</p>
              )}
              {booking.status === "ARCHIVED" && booking.archivedAt && (
                <p className="mt-1 text-xs text-muted-foreground">Archived {formatDate(booking.archivedAt)}</p>
              )}
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{booking.workshopId}</p>
              <p>
                {booking.participants} participant{booking.participants !== 1 ? "s" : ""}
                {booking.preferredDate && ` · ${booking.preferredDate}`}
              </p>
              {booking.notes && <p className="line-clamp-2 italic">&quot;{booking.notes}&quot;</p>}
            </div>
            <Select value={booking.status} onValueChange={(val) => updateStatus(booking.id, val)}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0) + status.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Class Bookings</h1>
          <p className="mt-1 text-muted-foreground">
            Manage booking requests, public calendar sessions, and resident seat holds.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{bookings.length} requests</Badge>
          <Badge variant="outline">{archivedBookings.length} archived</Badge>
          <Badge variant="outline">{activeSchedules.length} live schedules</Badge>
          <Badge variant="outline">{heldSeats} resident seats held</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="py-4">
          <CardContent className="flex items-center gap-4 px-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-yellow-800">
              <CircleDashed className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending requests</p>
              <p className="text-2xl font-semibold text-foreground">{pendingBookings.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-4 px-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-800">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Confirmed</p>
              <p className="text-2xl font-semibold text-foreground">{confirmedBookings.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-4 px-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Calendar sessions</p>
              <p className="text-2xl font-semibold text-foreground">{activeSchedules.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-4 px-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Resident seats</p>
              <p className="text-2xl font-semibold text-foreground">{heldSeats}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-4 px-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Archived</p>
              <p className="text-2xl font-semibold text-foreground">{archivedBookings.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
        Online checkout creates a short pending hold while the customer pays. Paid Xendit sessions should become confirmed automatically; onsite payment requests should be coordinated on WhatsApp and then marked confirmed after payment. Cancelled requests stay visible for 5 days, then move to Archive automatically.
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-fit">
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="holds">Resident Holds</TabsTrigger>
          <TabsTrigger value="archive">Archive</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader className="border-b pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="font-heading text-xl font-bold">Booking Requests</CardTitle>
                  <CardDescription>Review student inquiries and keep each request status current.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{pendingBookings.length} pending</Badge>
                  {recentCancelledBookings.length > 0 && (
                    <Badge variant="outline">{recentCancelledBookings.length} recent cancelled</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {renderBookingList(bookings, "No active bookings", "Pending, confirmed, completed, and recently cancelled bookings will appear here.")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archive" className="space-y-4">
          <Card>
            <CardHeader className="border-b pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="font-heading text-xl font-bold">Archived Booking Requests</CardTitle>
                  <CardDescription>Cancelled requests older than 5 days land here. Change the status to restore a booking to the active queue.</CardDescription>
                </div>
                <Badge variant="secondary">{archivedBookings.length} archived</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {renderBookingList(archivedBookings, "No archived bookings", "Archived booking requests will appear here after the 5 day cancellation window.")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader className="border-b pb-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="font-heading text-xl font-bold">Availability Calendar</CardTitle>
                  <CardDescription>
                    Month view of public sessions, confirmed bookings, temporary holds, and open seats.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAvailabilityMonth((month) => shiftMonth(month, -1))}
                  >
                    Previous
                  </Button>
                  <span className="inline-flex h-9 min-w-36 items-center justify-center rounded-md border border-border px-3 text-sm font-medium">
                    {availabilityMonthLabel}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAvailabilityMonth((month) => shiftMonth(month, 1))}
                  >
                    Next
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={fetchAvailability} disabled={availabilityLoading}>
                    {availabilityLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Refresh
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Open seats</p>
                  <p className="text-2xl font-semibold text-foreground">{availabilityTotals.open}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Booked seats</p>
                  <p className="text-2xl font-semibold text-foreground">{availabilityTotals.booked}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Held seats</p>
                  <p className="text-2xl font-semibold text-foreground">{availabilityTotals.held}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Use Hold seat when someone books by WhatsApp or Instagram. Holds reduce public availability immediately.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {availabilityError ? (
                <div className="m-5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {availabilityError}
                </div>
              ) : availabilityLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : availabilityRows.length === 0 ? (
                <div className="py-12 text-center">
                  <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="font-medium text-foreground">No bookable sessions this month</p>
                  <p className="text-sm text-muted-foreground">Add sessions below or move to another month.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {Object.entries(availabilityByDate).map(([dateKey, rows]) => (
                    <div key={dateKey} className="grid gap-3 p-4 lg:grid-cols-[180px_minmax(0,1fr)] lg:p-5">
                      <div>
                        <p className="font-heading text-lg font-bold text-foreground">{formatDate(dateKey)}</p>
                        <p className="text-sm text-muted-foreground">{dayNames[dateKeyWeekday(dateKey)]}</p>
                      </div>
                      <div className="grid gap-2">
                        {rows.map((row) => {
                          const isFull = row.availableSeats <= 0
                          return (
                            <div
                              key={`${row.sessionId}-${row.timeLabel}`}
                              className="grid gap-3 rounded-md border border-border bg-background p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-foreground">{row.title}</p>
                                  <Badge variant="outline">{row.timeLabel}</Badge>
                                  <Badge variant={isFull ? "secondary" : "outline"}>
                                    {isFull ? "Full" : `${row.availableSeats} open`}
                                  </Badge>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  <span>{row.maxParticipants} seats total</span>
                                  <span>{row.bookedSeats} booked</span>
                                  <span>{row.heldSeats} held</span>
                                  <span>{row.category}</span>
                                  <span>shared time pool</span>
                                </div>
                                {row.holds.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {row.holds.map((hold) => (
                                      <Badge key={hold.id} variant="secondary">
                                        {hold.studentName}: {hold.seats}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isFull}
                                onClick={() => prefillHoldFromAvailability(row)}
                              >
                                Hold seat
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="font-heading text-xl font-bold">Public Calendar Sessions</CardTitle>
                  <CardDescription>Sessions shown here are what students can see and book on the calendar.</CardDescription>
                </div>
                <Badge variant="secondary">{activeSchedules.length} active</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {schedules.length === 0 ? (
                <div className="py-12 text-center">
                  <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="font-medium text-foreground">No calendar sessions yet</p>
                  <p className="text-sm text-muted-foreground">Add the first public session below.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Session</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12 pr-5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((schedule) => {
                      const offering = classOptions.find((item) => item.id === schedule.offeringId)
                      const weekdays = parseWeekdayList(schedule.weekdays)
                      return (
                        <TableRow key={schedule.id}>
                          <TableCell className="pl-5">
                            <div className="font-medium text-foreground">{schedule.title}</div>
                            <div className="text-xs text-muted-foreground">{offering?.title || schedule.offeringId}</div>
                          </TableCell>
                          <TableCell>
                            <div>{formatDateRange(schedule.startDate, schedule.endDate)}</div>
                            <div className="text-xs text-muted-foreground">{weekdayLabel(weekdays)}</div>
                          </TableCell>
                          <TableCell>{schedule.timeLabel}</TableCell>
                          <TableCell>{schedule.maxParticipants}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{schedule.category}</Badge>
                              <Badge variant={schedule.status === "ACTIVE" ? "secondary" : "outline"}>{schedule.status}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="pr-5 text-right">
                            <Button variant="ghost" size="icon" onClick={() => deleteSchedule(schedule.id)} aria-label={`Delete schedule ${schedule.title}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-5">
              <Accordion type="single" collapsible>
                <AccordionItem value="add-schedule">
                  <AccordionTrigger className="py-0 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <CalendarPlus className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-heading text-base font-bold text-foreground">Add calendar schedule</p>
                        <p className="text-sm font-normal text-muted-foreground">Create a class, event, or multi-day run for the public calendar.</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-5">
                    <div className="grid gap-4 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Schedule type</Label>
                        <Select value={scheduleForm.category} onValueChange={(value) => setScheduleForm((prev) => ({ ...prev, category: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly-class">Weekly class</SelectItem>
                            <SelectItem value="multi-day">Multi-day workshop</SelectItem>
                            <SelectItem value="event">Event</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Offering</Label>
                        <Select
                          value={scheduleForm.offeringId}
                          onValueChange={(value) => {
                            const offering = classOptions.find((item) => item.id === value) || classOptions[0]
                            setScheduleForm((prev) => ({
                              ...prev,
                              offeringId: value,
                              title: offering.title,
                              maxParticipants: (offering.maxParticipants || 8).toString(),
                            }))
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {classOptions.map((offering) => (
                              <SelectItem key={offering.id} value={offering.id}>{offering.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="schedule-title">Display title</Label>
                        <Input
                          id="schedule-title"
                          value={scheduleForm.title}
                          onChange={(event) => setScheduleForm((prev) => ({ ...prev, title: event.target.value }))}
                          placeholder={selectedScheduleOffering.title}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="schedule-time">Time</Label>
                        <Input
                          id="schedule-time"
                          value={scheduleForm.timeLabel}
                          onChange={(event) => setScheduleForm((prev) => ({ ...prev, timeLabel: event.target.value }))}
                          placeholder="10:00 - 12:00 PM"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="schedule-capacity">Capacity</Label>
                        <Input
                          id="schedule-capacity"
                          type="number"
                          min="1"
                          value={scheduleForm.maxParticipants}
                          onChange={(event) => setScheduleForm((prev) => ({ ...prev, maxParticipants: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="schedule-start">Start date</Label>
                        <Input
                          id="schedule-start"
                          type="date"
                          value={scheduleForm.startDate}
                          onChange={(event) => setScheduleForm((prev) => ({ ...prev, startDate: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="schedule-end">End date</Label>
                        <Input
                          id="schedule-end"
                          type="date"
                          value={scheduleForm.endDate}
                          onChange={(event) => setScheduleForm((prev) => ({ ...prev, endDate: event.target.value }))}
                          placeholder="Optional"
                        />
                      </div>
                      {isRecurringSchedule && (
                        <div className="space-y-2">
                          <Label>Repeats on</Label>
                          <div className="flex flex-wrap gap-2">
                            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleScheduleWeekday(day)}
                                className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
                                  scheduleForm.weekdays.includes(day.toString())
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {dayNames[day].slice(0, 3)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                      <div className="space-y-2">
                        <Label htmlFor="schedule-notes">Notes</Label>
                        <Textarea
                          id="schedule-notes"
                          value={scheduleForm.notes}
                          onChange={(event) => setScheduleForm((prev) => ({ ...prev, notes: event.target.value }))}
                          placeholder="Optional internal notes"
                          rows={2}
                        />
                      </div>
                      <Button onClick={createSchedule} disabled={savingSchedule || !scheduleForm.startDate || !scheduleForm.timeLabel} className="h-10">
                        {savingSchedule && <Loader2 className="h-4 w-4 animate-spin" />}
                        Add Schedule
                      </Button>
                    </div>
                    {scheduleError && <p className="mt-3 text-sm text-destructive">{scheduleError}</p>}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holds" className="space-y-4">
          <Card>
            <CardHeader className="border-b pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="font-heading text-xl font-bold">Resident Schedule Holds</CardTitle>
                  <CardDescription>Reserved resident seats reduce public class availability automatically.</CardDescription>
                </div>
                <Badge variant="secondary">{heldSeats} seats held</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {holds.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="font-medium text-foreground">No resident holds yet</p>
                  <p className="text-sm text-muted-foreground">Add recurring resident seat reservations below.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Seats</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12 pr-5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holds.map((hold) => {
                      const workshop = classOptions.find((item) => item.id === hold.workshopId)
                      const weekdays = parseWeekdayList(hold.weekdays)
                      return (
                        <TableRow key={hold.id}>
                          <TableCell className="pl-5">
                            <div className="font-medium text-foreground">{hold.studentName}</div>
                            <div className="text-xs text-muted-foreground">{hold.studentEmail || "No email"}</div>
                          </TableCell>
                          <TableCell>
                            <div>{workshop?.title || hold.workshopId}</div>
                            <div className="text-xs text-muted-foreground">{hold.timeLabel} · {weekdayLabel(weekdays)}</div>
                          </TableCell>
                          <TableCell>{formatDateRange(hold.startDate, hold.endDate)}</TableCell>
                          <TableCell>{hold.seats}</TableCell>
                          <TableCell>
                            <Badge variant={hold.status === "ACTIVE" ? "secondary" : "outline"}>{hold.status}</Badge>
                          </TableCell>
                          <TableCell className="pr-5">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditHold(hold)} aria-label={`Edit hold for ${hold.studentName}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteHold(hold.id)} aria-label={`Delete hold for ${hold.studentName}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-5">
              <Accordion type="single" collapsible value={holdAccordionValue} onValueChange={setHoldAccordionValue}>
                <AccordionItem value="add-hold">
                  <AccordionTrigger className="py-0 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-heading text-base font-bold text-foreground">
                          {editingHoldId ? "Edit resident hold" : "Add resident hold"}
                        </p>
                        <p className="text-sm font-normal text-muted-foreground">
                          Reserve or adjust resident seats. Custom times are for approved schedule changes.
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-5">
                    <div className="grid gap-4 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label htmlFor="student-name">Student name</Label>
                        <Input
                          id="student-name"
                          value={holdForm.studentName}
                          onChange={(event) => setHoldForm((prev) => ({ ...prev, studentName: event.target.value }))}
                          placeholder="Resident student"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="student-email">Email</Label>
                        <Input
                          id="student-email"
                          value={holdForm.studentEmail}
                          onChange={(event) => setHoldForm((prev) => ({ ...prev, studentEmail: event.target.value }))}
                          placeholder="optional"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Class slot</Label>
                        <Select
                          value={holdForm.workshopId}
                          onValueChange={(value) => {
                            const nextWorkshop = classOptions.find((workshop) => workshop.id === value) || classOptions[0]
                            const nextWeekdays = (nextWorkshop.schedule?.flatMap(parseScheduleDays) || []).slice(0, 1).map(String)
                            setHoldForm((prev) => ({
                              ...prev,
                              workshopId: value,
                              timeLabel: prev.allowCustomTime
                                ? prev.timeLabel
                                : nextWorkshop.schedule?.[0] ? parseTimeLabel(nextWorkshop.schedule[0]) : "",
                              seats: "1",
                              weekdays: prev.allowCustomTime ? prev.weekdays : nextWeekdays,
                            }))
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {classOptions.map((workshop) => (
                              <SelectItem key={workshop.id} value={workshop.id}>{workshop.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label>Time</Label>
                          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={holdForm.allowCustomTime}
                              onChange={(event) => {
                                const enabled = event.target.checked
                                setHoldForm((prev) => ({
                                  ...prev,
                                  allowCustomTime: enabled,
                                  weekdays: enabled
                                    ? prev.weekdays
                                    : selectedWeekdays.slice(0, 1).map(String),
                                  timeLabel: enabled
                                    ? prev.timeLabel
                                    : selectedTimes[0] || prev.timeLabel,
                                }))
                              }}
                              className="h-4 w-4 rounded border-border"
                            />
                            Use any studio time
                          </label>
                        </div>
                        {holdForm.allowCustomTime ? (
                          <Select value={holdForm.timeLabel} onValueChange={(value) => setHoldForm((prev) => ({ ...prev, timeLabel: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {allKnownTimeLabels.map((time) => (
                                <SelectItem key={time} value={time}>{time}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : selectedTimes.length > 0 ? (
                          <Select value={holdForm.timeLabel} onValueChange={(value) => setHoldForm((prev) => ({ ...prev, timeLabel: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedTimes.map((time) => (
                                <SelectItem key={time} value={time}>{time}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={holdForm.timeLabel}
                            onChange={(event) => setHoldForm((prev) => ({ ...prev, timeLabel: event.target.value }))}
                            placeholder="10:00 - 12:00 PM"
                          />
                        )}
                        {holdForm.allowCustomTime && (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Use this for approved resident schedule changes. It still blocks the shared seat pool for that exact date and time.
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hold-seats">Seats held</Label>
                        <Select value={holdForm.seats} onValueChange={(value) => setHoldForm((prev) => ({ ...prev, seats: value }))}>
                          <SelectTrigger id="hold-seats">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: maxSeats }, (_, index) => index + 1).map((seat) => (
                              <SelectItem key={seat} value={seat.toString()}>{seat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hold-start">Start date</Label>
                        <Input
                          id="hold-start"
                          type="date"
                          value={holdForm.startDate}
                          onChange={(event) => setHoldForm((prev) => ({ ...prev, startDate: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hold-end">End date</Label>
                        <Input
                          id="hold-end"
                          type="date"
                          value={holdForm.endDate}
                          onChange={(event) => setHoldForm((prev) => ({ ...prev, endDate: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Class days</Label>
                        <div className="flex flex-wrap gap-2">
                          {holdWeekdayChoices.map((day) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleWeekday(day)}
                              className={`rounded-md border px-3 py-2 text-xs font-medium transition ${
                                holdForm.weekdays.includes(day.toString())
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {dayNames[day].slice(0, 3)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                      <div className="space-y-2">
                        <Label htmlFor="hold-notes">Notes</Label>
                        <Textarea
                          id="hold-notes"
                          value={holdForm.notes}
                          onChange={(event) => setHoldForm((prev) => ({ ...prev, notes: event.target.value }))}
                          placeholder="Optional schedule notes"
                          rows={2}
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                        <Button
                          onClick={saveHold}
                          disabled={savingHold || !holdForm.studentName || !holdForm.startDate || holdForm.weekdays.length === 0}
                          className="h-10"
                        >
                          {savingHold && <Loader2 className="h-4 w-4 animate-spin" />}
                          {editingHoldId ? "Update Hold" : "Add Hold"}
                        </Button>
                        {editingHoldId && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={resetHoldForm}
                            disabled={savingHold}
                            className="h-10"
                          >
                            Cancel edit
                          </Button>
                        )}
                      </div>
                    </div>
                    {holdError && <p className="mt-3 text-sm text-destructive">{holdError}</p>}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
