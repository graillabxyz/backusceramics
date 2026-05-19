"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CalendarDays, GraduationCap, Loader2, Trash2 } from "lucide-react"
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
  category: "class",
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
      <div>
        <h1 className="font-heading font-bold text-3xl text-foreground">Class Bookings</h1>
        <p className="text-muted-foreground mt-1">
          Manage workshop and class booking requests
        </p>
      </div>

      <Card>
        <CardContent className="p-5 lg:p-6">
          <div className="flex flex-col gap-1 mb-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle className="font-heading font-bold text-xl">Calendar Schedule</CardTitle>
            </div>
            <CardDescription>
              Add the actual sessions that appear on the public calendar. Use weekly classes for wheel/handbuilding, event for private gatherings, and multi-day run for 3 or 6 day workshops.
            </CardDescription>
          </div>

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

          {schedules.length > 0 && (
            <div className="mt-6 grid gap-2">
              {schedules.map((schedule) => {
                const offering = classOptions.find((item) => item.id === schedule.offeringId)
                const weekdays = schedule.weekdays ? JSON.parse(schedule.weekdays) as number[] : []
                return (
                  <div key={schedule.id} className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-4 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{schedule.title}</p>
                        <Badge variant="outline">{schedule.category}</Badge>
                        <Badge variant="secondary">Cap {schedule.maxParticipants}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {offering?.title || schedule.offeringId} · {schedule.timeLabel}
                        {weekdays.length > 0 && ` · ${weekdays.map((day) => dayNames[day].slice(0, 3)).join(", ")}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(schedule.startDate).toLocaleDateString()} - {schedule.endDate ? new Date(schedule.endDate).toLocaleDateString() : "single day / ongoing"}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteSchedule(schedule.id)} aria-label={`Delete schedule ${schedule.title}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 lg:p-6">
          <div className="flex flex-col gap-1 mb-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle className="font-heading font-bold text-xl">Resident Schedule Holds</CardTitle>
            </div>
            <CardDescription>
              Reserve wheel or handbuilding seats for resident students. These holds reduce public class availability automatically.
            </CardDescription>
          </div>

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

          {holds.length > 0 && (
            <div className="mt-6 space-y-2">
              {holds.map((hold) => {
                const workshop = classOptions.find((item) => item.id === hold.workshopId)
                const weekdays = JSON.parse(hold.weekdays) as number[]
                return (
                  <div key={hold.id} className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-4 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{hold.studentName}</p>
                        <Badge variant="outline">{hold.seats} seat{hold.seats !== 1 ? "s" : ""}</Badge>
                        <Badge variant="secondary">{hold.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {workshop?.title || hold.workshopId} · {hold.timeLabel} · {weekdays.map((day) => dayNames[day].slice(0, 3)).join(", ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(hold.startDate).toLocaleDateString()} - {hold.endDate ? new Date(hold.endDate).toLocaleDateString() : "ongoing"}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteHold(hold.id)} aria-label={`Delete hold for ${hold.studentName}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="font-heading font-bold text-lg mb-2">No bookings yet</CardTitle>
            <CardDescription>
              Class bookings will appear here when students sign up.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <Card key={booking.id}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-foreground">{booking.contactName}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[booking.status]}`}>
                        {booking.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {booking.contactEmail} · Workshop: {booking.workshopId}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {booking.participants} participant{booking.participants !== 1 ? "s" : ""}
                      {booking.preferredDate && ` · Preferred: ${booking.preferredDate}`}
                    </p>
                    {booking.notes && (
                      <p className="text-sm text-muted-foreground mt-1 italic">&quot;{booking.notes}&quot;</p>
                    )}
                  </div>
                  <Select
                    value={booking.status}
                    onValueChange={(val) => updateStatus(booking.id, val)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
