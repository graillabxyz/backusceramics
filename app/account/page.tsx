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

const orderSteps = ["INQUIRY", "REVIEWING", "QUOTED", "ACCEPTED", "IN_PROGRESS", "GLAZING", "FIRING", "COMPLETED"]

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
  if (status === "CANCELLED") return "border-border bg-muted text-muted-foreground"
  return "border-primary/20 bg-primary/10 text-primary"
}

function orderProgress(status: string) {
  const index = orderSteps.indexOf(status)
  if (status === "SHIPPED" || status === "COMPLETED") return 100
  if (index < 0) return 12
  return Math.max(12, Math.round(((index + 1) / orderSteps.length) * 100))
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

        if (ordersRes.ok) setOrders(await ordersRes.json())
        if (bookingsRes.ok) setBookings(await bookingsRes.json())
      } catch (error) {
        console.error("Failed to load account dashboard", error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const availableClasses = useMemo(
    () => workshops.filter((workshop) => workshop.available && workshop.category !== "residency").slice(0, 3),
    []
  )
  const activeOrders = orders.filter((order) => !["COMPLETED", "SHIPPED", "CANCELLED"].includes(order.status))
  const upcomingBookings = bookings.filter((booking) => !["COMPLETED", "CANCELLED"].includes(booking.status))
  const nextBooking = upcomingBookings[0]
  const nextWorkshop = nextBooking ? workshops.find((item) => item.id === nextBooking.workshopId) : null
  const featuredOrder = activeOrders[0] || orders[0]
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
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Upcoming Classes</p>
              <p className="mt-1 text-3xl font-bold text-foreground">{upcomingBookings.length}</p>
            </div>
            <GraduationCap className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Active Orders</p>
              <p className="mt-1 text-3xl font-bold text-foreground">{activeOrders.length}</p>
            </div>
            <ShoppingBag className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Studio Requests</p>
              <p className="mt-1 text-3xl font-bold text-foreground">{bookings.length + orders.length}</p>
            </div>
            <ClipboardList className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Badge variant="secondary" className="mb-3">Studio dashboard</Badge>
                <CardTitle className="font-heading text-3xl">Welcome back, {firstName}</CardTitle>
                <CardDescription className="mt-2 max-w-2xl">
                  Your class schedule, custom order progress, and studio follow-ups in one place.
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/classes/calendar">
                  Book a Class
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Next class</p>
              {nextBooking ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="font-heading text-xl font-bold text-foreground">{nextWorkshop?.title || nextBooking.workshopId}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {nextBooking.preferredDate || "Date to be confirmed"} · {nextBooking.participants} participant{nextBooking.participants === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Badge className={statusTone(nextBooking.status)} variant="outline">
                    {bookingStatusLabels[nextBooking.status] || nextBooking.status}
                  </Badge>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="font-medium text-foreground">No upcoming class booked</p>
                  <p className="mt-1 text-sm text-muted-foreground">Choose a date from the class calendar when you are ready.</p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Custom order tracking</p>
              {featuredOrder ? (
                <div className="mt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-heading text-xl font-bold text-foreground">Order {featuredOrder.id.slice(0, 8)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {getPieceCount(featuredOrder.pieces)} piece{getPieceCount(featuredOrder.pieces) === 1 ? "" : "s"} · submitted {formatDate(featuredOrder.createdAt)}
                      </p>
                    </div>
                    <Badge className={statusTone(featuredOrder.status)} variant="outline">
                      {orderStatusLabels[featuredOrder.status] || featuredOrder.status}
                    </Badge>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${orderProgress(featuredOrder.status)}%` }} />
                  </div>
                  {featuredOrder.updates?.[0] && (
                    <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Latest update: {featuredOrder.updates[0].title}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-4">
                  <p className="font-medium text-foreground">No custom order yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Submit an idea and track every studio update here.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-xl">Quick Actions</CardTitle>
            <CardDescription>Common next steps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-between" asChild>
              <Link href="/classes/calendar">
                Book from calendar
                <CalendarDays className="h-4 w-4" />
              </Link>
            </Button>
            <Button className="w-full justify-between" variant="outline" asChild>
              <Link href="/custom-orders">
                Start custom order
                <PackageCheck className="h-4 w-4" />
              </Link>
            </Button>
            <Button className="w-full justify-between" variant="outline" asChild>
              <Link href="/account/bookings">
                View all bookings
                <GraduationCap className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="font-heading text-xl">Class Bookings</CardTitle>
                <CardDescription>Upcoming and recent class requests.</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/account/bookings">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <div className="py-10 text-center">
                <CalendarDays className="h-9 w-9 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm font-medium text-foreground">No bookings yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Your class requests will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.slice(0, 4).map((booking) => {
                  const workshop = workshops.find((item) => item.id === booking.workshopId)
                  return (
                    <div key={booking.id} className="rounded-lg border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm text-foreground">{workshop?.title || booking.workshopId}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
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
                <CardTitle className="font-heading text-xl">Custom Orders</CardTitle>
                <CardDescription>Status and latest studio updates.</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/custom-orders">New order</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="py-10 text-center">
                <ClipboardList className="h-9 w-9 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm font-medium text-foreground">No custom orders yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Submit a request to start tracking progress.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 4).map((order) => (
                  <div key={order.id} className="rounded-lg border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm text-foreground">Order {order.id.slice(0, 8)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {getPieceCount(order.pieces)} piece{getPieceCount(order.pieces) === 1 ? "" : "s"} · submitted {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <Badge className={statusTone(order.status)} variant="outline">
                        {orderStatusLabels[order.status] || order.status}
                      </Badge>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${orderProgress(order.status)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">Bookable Classes</h2>
            <p className="mt-1 text-sm text-muted-foreground">A small selection of available studio sessions.</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/classes/calendar">Open calendar</Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {availableClasses.map((workshop) => (
            <Card key={workshop.id} className="border-border/80">
              <CardContent className="p-5">
                <Badge variant="outline">{workshop.level}</Badge>
                <h3 className="mt-3 font-heading text-lg font-bold text-foreground">{workshop.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{workshop.duration} · {formatPrice(workshop.price)}</p>
                <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {workshop.schedule?.[0] || "Schedule varies"}
                </p>
                <Button className="mt-4 w-full" size="sm" asChild>
                  <Link href={`/classes/book/${workshop.slug}`}>Choose Date</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
