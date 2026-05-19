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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatPrice, Workshop } from "@/lib/classes-data"
import { Users, Calendar as CalendarIcon, Clock, Loader2 } from "lucide-react"
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
  const [success, setSuccess] = useState("")
  const [whatsappPhone, setWhatsappPhone] = useState("")
  const [payOnArrivalConfirmed, setPayOnArrivalConfirmed] = useState(false)
  const { isAuthenticated, openAuthModal } = useAuth()
  const maxParticipants = workshop.maxParticipants ?? 8
  const participantOptions = Array.from({ length: maxParticipants }, (_, index) => index + 1)
  const selectedSeatCount = parseInt(people || "1")
  const checkoutTotal = workshop.price * selectedSeatCount

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
    setSuccess("")

    if (!date) {
      setError("Choose a class date from the calendar.")
      return
    }

    if (!isAuthenticated) {
      setIsOpen(false)
      openAuthModal()
      return
    }

    const participants = parseInt(people)
    const trimmedPhone = whatsappPhone.trim()
    if (!trimmedPhone) {
      setError("Enter your WhatsApp phone number to book this class.")
      return
    }

    if (!payOnArrivalConfirmed) {
      setError("Confirm that you will pay the class total when you arrive.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workshopId: workshop.id,
          preferredDate: `${selectedDateValue}${time ? ` · ${time}` : ""}`,
          participants,
          contactPhone: trimmedPhone,
          notes: `Pay on arrival confirmed. Total due on arrival: ${formatPrice(workshop.price * participants)}.`,
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

    setPayOnArrivalConfirmed(false)
    setSuccess("Booking request sent. Backus Ceramics will confirm your spot by WhatsApp.")
    setIsSubmitting(false)
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
            <Select
              value={people}
              onValueChange={(value) => {
                setPeople(value)
                setError("")
                setSuccess("")
                setPayOnArrivalConfirmed(false)
              }}
            >
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

          <div className="grid gap-2">
            <Label htmlFor="modal-whatsapp">WhatsApp phone number</Label>
            <Input
              id="modal-whatsapp"
              type="tel"
              value={whatsappPhone}
              onChange={(event) => {
                setWhatsappPhone(event.target.value)
                setError("")
                setSuccess("")
              }}
              placeholder="+62 812 3456 7890"
              autoComplete="tel"
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/35 p-4">
            <p className="text-sm font-semibold text-foreground">Checkout</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4 text-muted-foreground">
                <span>{workshop.title}</span>
                <span>{formatPrice(workshop.price)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-muted-foreground">
                <span>Seats</span>
                <span>x {selectedSeatCount}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border pt-2 font-semibold text-foreground">
                <span>Total due on arrival</span>
                <span>{formatPrice(checkoutTotal)}</span>
              </div>
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
              <Checkbox
                checked={payOnArrivalConfirmed}
                onCheckedChange={(checked) => {
                  setPayOnArrivalConfirmed(checked === true)
                  setError("")
                }}
                className="mt-0.5"
              />
              <span>I understand this booking is held for me and I will pay {formatPrice(checkoutTotal)} when I arrive to class.</span>
            </label>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {success && (
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{success}</p>
          )}
        </div>

        <DialogFooter>
          <Button 
            onClick={handleBooking}
            className="w-full h-12 text-lg gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CalendarIcon className="h-5 w-5" />}
            {isSubmitting ? "Booking..." : isAuthenticated ? "Book Now" : "Sign in to Book"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
