"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
  Loader2,
  PackageCheck,
  ShoppingBag,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { formatPrice, workshops } from "@/lib/classes-data"

interface OrderUpdate {
  id: string
  title: string
  description?: string | null
  createdAt: string
}

interface Order {
  id: string
  status: string
  contactName: string
  pieces: string
  createdAt: string
  updates?: OrderUpdate[]
}

interface Booking {
  id: string
  workshopId: string
  status: string
  preferredDate?: string | null
  participants: number
  createdAt: string
}

const orderStatusLabels: Record<string, string> = {
  INQUIRY: "Submitted",
  REVIEWING: "Reviewing",
  QUOTED: "Quoted",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In Progress",
  GLAZING: "Glazing",
  FIRING: "Firing",
  COMPLETED: "Completed",
  SHIPPED: "Shipped",
  CANCELLED: "Cancelled",
}

const bookingStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

function getPieceCount(piecesJson: string) {
  try {
    const pieces = JSON.parse(piecesJson)
    return pieces.reduce((sum: number, piece: { quantity?: string }) => sum + (parseInt(piece.quantity || "0") || 0), 0)
  } catch {
    return 0
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function statusTone(status: string) {
  if (["CONFIRMED", "ACCEPTED", "COMPLETED", "SHIPPED"].includes(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
  }

  if (["IN_PROGRESS", "GLAZING", "FIRING", "QUOTED"].includes(status)) {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
  }

  if (["CANCELLED"].includes(status)) {
    return "border-border bg-muted text-muted-foreground"
  }

  return "border-primary/20 bg-primary/10 text-primary"
}

export default function AccountDashboardPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [ordersRes, bookingsRes] = await Promise.all([
          fetch("/api/orders"),
          fetch("/api/bookings"),
        ])

        if (ordersRes.ok) {
          setOrders(await ordersRes.json())
        }

        if (bookingsRes.ok) {
          setBookings(await bookingsRes.json())
        }
      } catch (error) {
        console.error("Failed to load account dashboard", error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const availableClasses = useMemo(
    () => workshops.filter((workshop) => workshop.available && workshop.category !== "residency"),
    []
  )
  const activeOrders = orders.filter((order) => !["COMPLETED", "SHIPPED", "CANCELLED"].includes(order.status))
  const upcomingBookings = bookings.filter((booking) => !["COMPLETED", "CANCELLED"].includes(booking.status))
  const nextBooking = upcomingBookings[0]
  const nextWorkshop = nextBooking ? workshops.find((item) => item.id === nextBooking.workshopId) : null
  const firstName = user?.name?.split(" ")[0] || "there"

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-4">Preparing your studio dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid lg:grid-cols-[1.4fr_0.9fr]">
          <div className="p-6 sm:p-8 lg:p-10">
            <Badge variant="secondary" className="mb-5">Studio dashboard</Badge>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-foreground">
              Welcome back, {firstName}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed">
              Manage upcoming classes, custom order progress, and studio conversations from one quiet place.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link href="/custom-orders">
                  Start a Custom Order
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/account/bookings">
                  Manage Bookings
                </Link>
              </Button>
            </div>
          </div>
          <div className="border-t lg:border-t-0 lg:border-l border-border bg-secondary/40 p-6 sm:p-8 lg:p-10">
            <p className="text-sm font-medium text-muted-foreground">Next studio touchpoint</p>
            {nextBooking ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="font-heading font-bold text-2xl text-foreground">{nextWorkshop?.title || nextBooking.workshopId}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {nextBooking.preferredDate || "Date to be confirmed"} · {nextBooking.participants} participant{nextBooking.participants === 1 ? "" : "s"}
                  </p>
                </div>
                <Badge className={statusTone(nextBooking.status)} variant="outline">
                  {bookingStatusLabels[nextBooking.status] || nextBooking.status}
                </Badge>
              </div>
            ) : (
              <div className="mt-4">
                <p className="font-heading font-bold text-2xl text-foreground">Choose your next class</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Pick a date from the calendar below and confirm your request with the studio.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-4">
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeOrders.length}</p>
            <p className="text-xs text-muted-foreground mt-2">{orders.length} total custom order submission{orders.length === 1 ? "" : "s"}</p>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Classes</CardTitle>
            <GraduationCap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{upcomingBookings.length}</p>
            <p className="text-xs text-muted-foreground mt-2">Pending and confirmed bookings</p>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available Workshops</CardTitle>
            <CalendarDays className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{availableClasses.length}</p>
            <p className="text-xs text-muted-foreground mt-2">Bookable from this dashboard</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold text-2xl text-foreground">Book a Class</h2>
            <p className="text-muted-foreground mt-1">Browse recurring sessions, choose a date, and send the studio your request.</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/classes/calendar">View calendar</Link>
          </Button>
        </div>

        <div className="grid xl:grid-cols-4 md:grid-cols-2 gap-4">
          {availableClasses.map((workshop) => (
            <Card key={workshop.id} className="overflow-hidden border-border/80">
              <div className="aspect-[4/3] bg-muted overflow-hidden">
                {workshop.image && (
                  <img src={workshop.image} alt={workshop.title} className="h-full w-full object-cover" />
                )}
              </div>
              <CardContent className="p-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline">{workshop.level}</Badge>
                    <span className="text-xs text-muted-foreground">Max {workshop.maxParticipants || 8}</span>
                  </div>
                  <h3 className="font-heading font-bold text-lg text-foreground mt-3">{workshop.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{workshop.duration} · {formatPrice(workshop.price)}</p>
                </div>
                <div className="space-y-2">
                  {workshop.schedule?.map((time) => (
                    <p key={time} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {time}
                    </p>
                  ))}
                </div>
                <Button className="w-full" size="sm" asChild>
                  <Link href={`/classes/calendar?class=${workshop.slug}`}>Choose Date</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border/80">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="font-heading font-bold text-xl">Class Bookings</CardTitle>
                <CardDescription>Pending and confirmed sessions with the studio.</CardDescription>
              </div>
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <div className="py-10 text-center">
                <CalendarDays className="h-9 w-9 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm font-medium text-foreground">No bookings yet</p>
                <p className="text-sm text-muted-foreground mt-1">Choose a class above to create your first request.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.slice(0, 5).map((booking) => {
                  const workshop = workshops.find((item) => item.id === booking.workshopId)
                  return (
                    <div key={booking.id} className="rounded-md border border-border bg-background/50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm text-foreground">{workshop?.title || booking.workshopId}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {booking.preferredDate || "Date to be confirmed"} · {booking.participants} participant{booking.participants === 1 ? "" : "s"}
                          </p>
                        </div>
                        <Badge className={statusTone(booking.status)} variant="outline">
                          {bookingStatusLabels[booking.status] || booking.status}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="font-heading font-bold text-xl">Custom Order Progress</CardTitle>
                <CardDescription>Submitted requests and active studio progress.</CardDescription>
              </div>
              <PackageCheck className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="py-10 text-center">
                <ClipboardList className="h-9 w-9 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm font-medium text-foreground">No custom orders yet</p>
                <p className="text-sm text-muted-foreground mt-1 mb-5">Share a brief and track the request here.</p>
                <Button variant="outline" asChild>
                  <Link href="/custom-orders">Start a custom order</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="rounded-md border border-border bg-background/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm text-foreground">Order {order.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getPieceCount(order.pieces)} piece{getPieceCount(order.pieces) === 1 ? "" : "s"} · submitted {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <Badge className={statusTone(order.status)} variant="outline">
                        {orderStatusLabels[order.status] || order.status}
                      </Badge>
                    </div>
                    {order.updates?.[0] ? (
                      <div className="mt-4 flex items-start gap-3 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        <span>Latest update: {order.updates[0].title}</span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
