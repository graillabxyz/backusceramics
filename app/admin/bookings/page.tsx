"use client"

import { useState, useEffect } from "react"
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
import { CalendarDays, CalendarPlus, CheckCircle2, CircleDashed, Clock, GraduationCap, Loader2, Trash2, Users } from "lucide-react"
import { dayNames, parseScheduleDays, parseTimeLabel, scheduleOfferings } from "@/lib/class-schedule"

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
}

const statusOptions = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"]

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

function formatDateRange(startDate: string, endDate: string | null) {
  return `${formatDate(startDate)} - ${endDate ? formatDate(endDate) : "ongoing"}`
}

function weekdayLabel(days: number[]) {
  if (days.length === 0) return "Single date"
  return days.map((day) => dayNames[day]?.slice(0, 3) || day).join(", ")
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [holds, setHolds] = useState<ClassHold[]>([])
  const [schedules, setSchedules] = useState<ClassSchedule[]>([])
  const [holdForm, setHoldForm] = useState(initialHoldForm)
  const [scheduleForm, setScheduleForm] = useState(initialScheduleForm)
  const [loading, setLoading] = useState(true)
  const [savingHold, setSavingHold] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [holdError, setHoldError] = useState("")
  const [scheduleError, setScheduleError] = useState("")

  const selectedWorkshop = classOptions.find((workshop) => workshop.id === holdForm.workshopId) || classOptions[0]
  const selectedTimes = selectedWorkshop.schedule?.map(parseTimeLabel) || []
  const selectedWeekdays = Array.from(new Set(selectedWorkshop.schedule?.flatMap(parseScheduleDays) || []))
  const maxSeats = selectedWorkshop.maxParticipants ?? 8
  const selectedScheduleOffering = classOptions.find((offering) => offering.id === scheduleForm.offeringId) || classOptions[0]
  const isRecurringSchedule = scheduleForm.category === "weekly-class"
  const pendingBookings = bookings.filter((booking) => booking.status === "PENDING")
  const confirmedBookings = bookings.filter((booking) => booking.status === "CONFIRMED")
  const activeSchedules = schedules.filter((schedule) => schedule.status !== "CANCELLED")
  const activeHolds = holds.filter((hold) => hold.status === "ACTIVE")
  const heldSeats = activeHolds.reduce((total, hold) => total + hold.seats, 0)

  useEffect(() => {
    fetchBookings()
    fetchHolds()
    fetchSchedules()
  }, [])

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

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status } : b))
        )
      }
    } catch (err) {
      console.error("Failed to update booking:", err)
    }
  }

  const createHold = async () => {
    setHoldError("")
    setSavingHold(true)

    try {
      const res = await fetch("/api/class-holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...holdForm,
          seats: Number(holdForm.seats),
          weekdays: holdForm.weekdays.map(Number),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Could not create resident schedule")
      }

      setHoldForm(initialHoldForm)
      await fetchHolds()
    } catch (err) {
      setHoldError(err instanceof Error ? err.message : "Could not create resident schedule")
    } finally {
      setSavingHold(false)
    }
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
      if (res.ok) setHolds((prev) => prev.filter((hold) => hold.id !== id))
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
          <Badge variant="outline">{activeSchedules.length} live schedules</Badge>
          <Badge variant="outline">{heldSeats} resident seats held</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
      </div>

      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
        Online checkout creates a short pending hold while the customer pays. Paid Xendit sessions should become confirmed automatically; onsite payment requests should be coordinated on WhatsApp and then marked confirmed after payment.
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-fit">
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="holds">Resident Holds</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader className="border-b pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="font-heading text-xl font-bold">Booking Requests</CardTitle>
                  <CardDescription>Review student inquiries and keep each request status current.</CardDescription>
                </div>
                <Badge variant="secondary">{pendingBookings.length} pending</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {bookings.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <GraduationCap className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <CardTitle className="mb-2 font-heading text-lg font-bold">No bookings yet</CardTitle>
                  <CardDescription>Class bookings will appear here when students sign up.</CardDescription>
                </div>
              ) : (
                <div className="divide-y">
                  {bookings.map((booking) => (
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
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
                          <TableCell className="pr-5 text-right">
                            <Button variant="ghost" size="icon" onClick={() => deleteHold(hold.id)} aria-label={`Delete hold for ${hold.studentName}`}>
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
                <AccordionItem value="add-hold">
                  <AccordionTrigger className="py-0 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-heading text-base font-bold text-foreground">Add resident hold</p>
                        <p className="text-sm font-normal text-muted-foreground">Reserve wheel or handbuilding seats for resident students.</p>
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
                            setHoldForm((prev) => ({
                              ...prev,
                              workshopId: value,
                              timeLabel: nextWorkshop.schedule?.[0] ? parseTimeLabel(nextWorkshop.schedule[0]) : "",
                              seats: "1",
                              weekdays: (nextWorkshop.schedule?.flatMap(parseScheduleDays) || []).slice(0, 1).map(String),
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
                        <Label>Time</Label>
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
                          {selectedWeekdays.map((day) => (
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
                      <Button
                        onClick={createHold}
                        disabled={savingHold || !holdForm.studentName || !holdForm.startDate || holdForm.weekdays.length === 0}
                        className="h-10"
                      >
                        {savingHold && <Loader2 className="h-4 w-4 animate-spin" />}
                        Add Hold
                      </Button>
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
