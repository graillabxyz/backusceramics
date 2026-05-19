"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GraduationCap, Loader2 } from "lucide-react"

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

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-gray-100 text-gray-800",
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBookings()
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
