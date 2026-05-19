"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarDays, GraduationCap, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingModal } from "@/components/classes/booking-modal"
import { formatPrice, workshops } from "@/lib/classes-data"

interface Booking {
  id: string
  workshopId: string
  status: string
  preferredDate?: string | null
  participants: number
  notes?: string | null
  createdAt: string
}

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadBookings() {
      try {
        const res = await fetch("/api/bookings")
        if (res.ok) {
          setBookings(await res.json())
        }
      } catch (error) {
        console.error("Failed to load bookings", error)
      } finally {
        setLoading(false)
      }
    }

    loadBookings()
  }, [])

  const availableClasses = workshops.filter((workshop) => workshop.available && workshop.category !== "residency")

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-2xl text-foreground">My Bookings</h2>
          <p className="text-muted-foreground mt-1">Your class bookings and upcoming workshop options</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/classes">View class page</Link>
        </Button>
      </div>

      <section className="space-y-4">
        {bookings.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle className="font-heading font-bold text-lg mb-2">No bookings yet</CardTitle>
              <CardDescription>
                Book a class below to create a pending request with the studio.
              </CardDescription>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => {
              const workshop = workshops.find((item) => item.id === booking.workshopId)
              return (
                <Card key={booking.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-medium text-foreground">{workshop?.title || booking.workshopId}</h3>
                          <Badge variant="secondary">{statusLabels[booking.status] || booking.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {booking.preferredDate || "Date to be confirmed"} · {booking.participants} participant{booking.participants === 1 ? "" : "s"}
                        </p>
                        {booking.notes && (
                          <p className="text-xs text-muted-foreground mt-2">{booking.notes}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Requested {new Date(booking.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="font-heading font-bold text-xl text-foreground">Book Another Class</h3>
          <p className="text-sm text-muted-foreground mt-1">Recurring weekly sessions available at the studio.</p>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          {availableClasses.map((workshop) => (
            <Card key={workshop.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-heading font-bold text-lg text-foreground">{workshop.title}</h4>
                    <p className="text-sm text-muted-foreground">{workshop.duration} · {formatPrice(workshop.price)}</p>
                    <div className="mt-3 space-y-1">
                      {workshop.schedule?.map((time) => (
                        <p key={time} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarDays className="h-4 w-4" />
                          {time}
                        </p>
                      ))}
                    </div>
                  </div>
                  <BookingModal workshop={workshop}>
                    <Button size="sm">Book</Button>
                  </BookingModal>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
