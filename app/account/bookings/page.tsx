"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarDays, Clock, GraduationCap, Loader2, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarExportButtons } from "@/components/calendar-export-buttons"
import { parsePreferredDateForCalendar } from "@/lib/calendar-export"
import { workshops } from "@/lib/classes-data"

interface Booking {
  id: string
  workshopId: string
  status: string
  preferredDate?: string | null
  participants: number
  notes?: string | null
  paymentReference?: string | null
  paymentSessionId?: string | null
  holdExpiresAt?: string | null
  confirmedAt?: string | null
  createdAt: string
}

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMING_PAYMENT: "Confirming payment",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

function statusTone(status: string) {
  if (status === "CONFIRMED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
  }
  if (status === "CONFIRMING_PAYMENT") {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
  }
  if (status === "PENDING") return "border-primary/20 bg-primary/10 text-primary"
  return "border-border bg-muted text-muted-foreground"
}

function BookingCard({ booking }: { booking: Booking }) {
  const workshop = workshops.find((item) => item.id === booking.workshopId)
  const displayStatus = booking.status === "PENDING" && (booking.paymentReference || booking.paymentSessionId)
    ? "CONFIRMING_PAYMENT"
    : booking.status
  const calendarDate = parsePreferredDateForCalendar(booking.preferredDate)
  const calendarEvent = calendarDate
    ? {
        title: `${workshop?.title || booking.workshopId} at Backus Ceramics`,
        dateKey: calendarDate.dateKey,
        timeLabel: calendarDate.timeLabel,
        description: `${booking.participants} participant${booking.participants === 1 ? "" : "s"} · ${statusLabels[displayStatus] || displayStatus}`,
      }
    : null

  return (
    <Card className="border-border/80">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-lg font-bold text-foreground">{workshop?.title || booking.workshopId}</h3>
              <Badge className={statusTone(displayStatus)} variant="outline">
                {statusLabels[displayStatus] || displayStatus}
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <p className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {booking.preferredDate || "Date to be confirmed"}
              </p>
              <p className="flex items-start gap-2">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {booking.participants} participant{booking.participants === 1 ? "" : "s"}
              </p>
            </div>
            {booking.notes && (
              <p className="mt-3 rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">{booking.notes}</p>
            )}
            {calendarEvent && booking.status !== "CANCELLED" && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add to calendar</p>
                <CalendarExportButtons event={calendarEvent} compact />
              </div>
            )}
          </div>
          <p className="whitespace-nowrap text-xs text-muted-foreground">
            Requested {new Date(booking.createdAt).toLocaleDateString()}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [recentPaymentReference, setRecentPaymentReference] = useState("")

  useEffect(() => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
    const paymentSucceeded = params?.get("payment") === "success"
    const reference = params?.get("reference") || ""
    if (paymentSucceeded) setRecentPaymentReference(reference || "recent payment")

    async function loadBookings() {
      try {
        const res = await fetch("/api/bookings")
        if (res.ok) setBookings(await res.json())
      } catch (error) {
        console.error("Failed to load bookings", error)
      } finally {
        setLoading(false)
      }
    }

    void loadBookings()

    let interval: number | undefined
    if (paymentSucceeded) {
      let attempts = 0
      interval = window.setInterval(() => {
        attempts += 1
        void loadBookings()
        if (attempts >= 8 && interval) window.clearInterval(interval)
      }, 2500)
    }

    return () => {
      if (interval) window.clearInterval(interval)
    }
  }, [])

  const upcomingBookings = useMemo(
    () => bookings.filter((booking) => !["COMPLETED", "CANCELLED"].includes(booking.status)),
    [bookings]
  )
  const pastBookings = useMemo(
    () => bookings.filter((booking) => ["COMPLETED", "CANCELLED"].includes(booking.status)),
    [bookings]
  )
  const confirmedCount = bookings.filter((booking) => booking.status === "CONFIRMED").length
  const pendingCount = bookings.filter((booking) => booking.status === "PENDING").length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {recentPaymentReference && (
        <Card className="border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CardContent className="p-5">
            <p className="font-semibold">Payment received</p>
            <p className="mt-1 text-sm leading-relaxed">
              We are confirming the booking status with the payment provider. This page will refresh automatically for a few moments.
            </p>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/80">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Upcoming</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{upcomingBookings.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Confirmed</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{confirmedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{pendingCount}</p>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">My Bookings</h2>
            <p className="mt-1 text-sm text-muted-foreground">Track requested, pending, and confirmed studio classes.</p>
          </div>
          <Button asChild>
            <Link href="/classes/calendar">
              Book from Calendar
              <CalendarDays className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-heading text-xl font-bold text-foreground">Upcoming</h3>
            <p className="mt-1 text-sm text-muted-foreground">Pending and confirmed bookings that still need attention.</p>
          </div>
        </div>

        {upcomingBookings.length === 0 ? (
          <Card className="border-border/80">
            <CardContent className="py-14 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <GraduationCap className="h-7 w-7 text-muted-foreground" />
              </div>
              <CardTitle className="mb-2 font-heading text-lg">No upcoming bookings</CardTitle>
              <CardDescription>Choose a class from the calendar when you are ready.</CardDescription>
              <Button className="mt-5" asChild>
                <Link href="/classes/calendar">Open Calendar</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingBookings.map((booking) => <BookingCard key={booking.id} booking={booking} />)}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="font-heading text-xl font-bold text-foreground">Past Activity</h3>
          <p className="mt-1 text-sm text-muted-foreground">Completed or cancelled bookings stay here for reference.</p>
        </div>

        {pastBookings.length === 0 ? (
          <Card className="border-border/80">
            <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-primary" />
              No past booking activity yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pastBookings.map((booking) => <BookingCard key={booking.id} booking={booking} />)}
          </div>
        )}
      </section>
    </div>
  )
}
