"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Workshop } from "@/lib/classes-data"
import { MessageCircle, Users, Calendar as CalendarIcon, Clock } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

interface BookingModalProps {
  workshop: Workshop
  children: React.ReactNode
}

export function BookingModal({ workshop, children }: BookingModalProps) {
  const [people, setPeople] = useState("1")
  const [time, setTime] = useState(workshop.schedule?.[0] || "")
  const [date, setDate] = useState<Date | undefined>()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const { isAuthenticated, openAuthModal } = useAuth()
  const maxParticipants = workshop.maxParticipants ?? 8
  const participantOptions = Array.from({ length: maxParticipants }, (_, index) => index + 1)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const selectedDateLabel = date
    ? date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : ""

  const selectedDateValue = date
    ? date.toLocaleDateString("en-CA")
    : ""

  const handleBooking = async () => {
    setError("")

    if (!date) {
      setError("Choose a class date from the calendar.")
      return
    }

    if (!isAuthenticated) {
      setIsOpen(false)
      openAuthModal()
      return
    }

    setIsSubmitting(true)

    try {
      const participants = parseInt(people)
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workshopId: workshop.id,
          preferredDate: `${selectedDateValue}${time ? ` · ${time}` : ""}`,
          participants,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Could not create booking request")
      }
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : "Could not create booking request")
      setIsSubmitting(false)
      return
    }

    const message = `Hi Backus Ceramics! I'd like to book the "${workshop.title}" for ${people} ${parseInt(people) === 1 ? 'person' : 'people'}. Requested date: ${selectedDateLabel}.${time ? ` Preferred time: ${time}.` : ''}`
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/6282145890402?text=${encodedMessage}`
    
    window.open(whatsappUrl, "_blank")
    setIsSubmitting(false)
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading font-bold">Book your Class</DialogTitle>
          <DialogDescription>
            Select your preferred time and group size for {workshop.title}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="people" className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Number of People
            </Label>
            <Select value={people} onValueChange={setPeople}>
              <SelectTrigger id="people">
                <SelectValue placeholder="Select count" />
              </SelectTrigger>
              <SelectContent>
                {participantOptions.map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} {num === 1 ? 'Person' : 'People'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Maximum {maxParticipants} {maxParticipants === 1 ? "person" : "people"} for this session.
            </p>
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              Choose a Class Date
            </Label>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={{ before: today }}
              className="w-full rounded-md border"
            />
            {selectedDateLabel && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedDateLabel}
              </p>
            )}
          </div>

          {workshop.schedule && workshop.schedule.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="time" className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Available Sessions
              </Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger id="time">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {workshop.schedule.map((session) => (
                    <SelectItem key={session} value={session}>
                      {session}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button 
            onClick={handleBooking}
            className="w-full h-12 text-lg gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white border-none"
            disabled={isSubmitting}
          >
            <MessageCircle className="h-5 w-5" />
            {isSubmitting ? "Creating Booking..." : isAuthenticated ? "Book via WhatsApp" : "Sign in to Book"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
