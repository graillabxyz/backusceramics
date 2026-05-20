"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, CalendarDays, Clock, Loader2 } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"
import { formatPrice } from "@/lib/classes-data"

interface CheckoutMeeting {
  key: string
  dateKey: string
  dateLabel: string
  timeLabel: string
}

function parseMeetings(value: string | null) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is CheckoutMeeting => {
      return Boolean(item?.key && item?.dateKey && item?.dateLabel && item?.timeLabel)
    })
  } catch {
    return []
  }
}

function ClassCheckoutContent() {
  const searchParams = useSearchParams()
  const { isAuthenticated, openAuthModal } = useAuth()
  const workshopId = searchParams.get("workshopId") || ""
  const scheduleId = searchParams.get("scheduleId") || ""
  const title = searchParams.get("title") || "Class booking"
  const dateKey = searchParams.get("dateKey") || ""
  const dateLabel = searchParams.get("dateLabel") || "Selected date"
  const timeLabel = searchParams.get("timeLabel") || "Selected time"
  const price = Number(searchParams.get("price") || 0)
  const maxSeats = Math.max(Number(searchParams.get("maxSeats") || 1), 0)
  const initialSeats = Math.min(Math.max(Number(searchParams.get("seats") || 1), 1), Math.max(maxSeats, 1))
  const prepaid = searchParams.get("prepaid") === "true"
  const requiredMeetings = Math.max(Number(searchParams.get("requiredMeetings") || 0), 0)
  const meetings = useMemo(() => parseMeetings(searchParams.get("meetings")), [searchParams])

  const [people, setPeople] = useState(initialSeats.toString())
  const [whatsappPhone, setWhatsappPhone] = useState("")
  const [payOnArrivalConfirmed, setPayOnArrivalConfirmed] = useState(false)
  const [selectedMeetingKeys, setSelectedMeetingKeys] = useState(() => meetings.map((meeting) => meeting.key))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const selectedSeatCount = Number(people || 1)
  const total = price * selectedSeatCount
  const participantOptions = Array.from({ length: maxSeats }, (_, index) => index + 1)
  const selectedMeetings = meetings.filter((meeting) => selectedMeetingKeys.includes(meeting.key))

  const handleSubmit = async () => {
    setError("")
    setSuccess("")

    if (!isAuthenticated) {
      openAuthModal()
      return
    }

    if (!whatsappPhone.trim()) {
      setError("Enter your WhatsApp phone number.")
      return
    }

    if (prepaid) {
      if (requiredMeetings > 0 && selectedMeetings.length !== requiredMeetings) {
        setError(`Choose exactly ${requiredMeetings} program ${requiredMeetings === 1 ? "meeting" : "meetings"} before checkout.`)
        return
      }

      if (selectedMeetings.length === 0) {
        setError("Choose at least one program meeting before checkout.")
        return
      }
      setError("Online payment is required to confirm this program. Payment checkout will be enabled once the payment gateway is connected.")
      return
    }

    if (!payOnArrivalConfirmed) {
      setError("Confirm that you will pay the class total when you arrive.")
      return
    }

    setIsSubmitting(true)
    try {
      const preferredDate = `${dateKey} · ${timeLabel}`
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workshopId,
          scheduleId: scheduleId || null,
          preferredDate,
          participants: selectedSeatCount,
          contactPhone: whatsappPhone.trim(),
          notes: `Pay on arrival confirmed. Total due on arrival: ${formatPrice(total)}.`,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Could not create booking request")
      }

      setPayOnArrivalConfirmed(false)
      setSuccess("Booking request sent. Backus Ceramics will confirm your spot by WhatsApp.")
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : "Could not create booking request")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <section className="border-b border-border bg-secondary/25 pt-24 pb-6">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" asChild className="mb-4 px-0">
            <Link href="/classes/calendar">
              <ArrowLeft className="h-4 w-4" />
              Back to calendar
            </Link>
          </Button>
          <Badge variant="secondary" className="mb-3">Checkout</Badge>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Confirm your booking.
          </h1>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="space-y-6">
          <Card className="border-border">
            <CardContent className="p-6">
              <h2 className="font-heading text-2xl font-bold text-foreground">{title}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-muted/60 p-3">
                  <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Date
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{dateLabel}</p>
                </div>
                <div className="rounded-md bg-muted/60 p-3">
                  <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Time
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{timeLabel}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="checkout-seats">Seats</Label>
                  <Select value={people} onValueChange={setPeople} disabled={maxSeats <= 0}>
                    <SelectTrigger id="checkout-seats">
                      <SelectValue placeholder={maxSeats <= 0 ? "No seats available" : "Select seats"} />
                    </SelectTrigger>
                    <SelectContent>
                      {participantOptions.map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} {num === 1 ? "Person" : "People"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checkout-whatsapp">WhatsApp phone number</Label>
                  <Input
                    id="checkout-whatsapp"
                    type="tel"
                    value={whatsappPhone}
                    onChange={(event) => {
                      setWhatsappPhone(event.target.value)
                      setError("")
                    }}
                    placeholder="+62 812 3456 7890"
                    autoComplete="tel"
                  />
                </div>
              </div>

              {prepaid && (
                <div className="rounded-lg border border-border bg-muted/35 p-4">
                  <p className="text-sm font-semibold text-foreground">Program meetings</p>
                  <div className="mt-3 space-y-2">
                    {meetings.map((meeting) => (
                      <label key={meeting.key} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <Checkbox
                          checked={selectedMeetingKeys.includes(meeting.key)}
                          disabled={
                            requiredMeetings > 0 &&
                            selectedMeetingKeys.includes(meeting.key) &&
                            selectedMeetingKeys.length <= requiredMeetings
                          }
                          onCheckedChange={(checked) => {
                            setSelectedMeetingKeys((current) =>
                              checked === true
                                ? Array.from(new Set([...current, meeting.key]))
                                : current.filter((key) => key !== meeting.key)
                            )
                            setError("")
                          }}
                          className="mt-0.5"
                        />
                        <span>{meeting.dateLabel} · {meeting.timeLabel}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="border-border">
            <CardContent className="space-y-5 p-6">
              <div>
                <p className="text-sm font-semibold text-foreground">Payment summary</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4 text-muted-foreground">
                    <span>{title}</span>
                    <span>{formatPrice(price)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-muted-foreground">
                    <span>Seats</span>
                    <span>x {selectedSeatCount}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-border pt-2 font-semibold text-foreground">
                    <span>{prepaid ? "Total due today" : "Total due on arrival"}</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>
              </div>

              {prepaid ? (
                <p className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground">
                  Online payment is required to confirm this program. Checkout will be enabled here once the payment gateway is connected.
                </p>
              ) : (
                <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                  <Checkbox
                    checked={payOnArrivalConfirmed}
                    onCheckedChange={(checked) => {
                      setPayOnArrivalConfirmed(checked === true)
                      setError("")
                    }}
                    className="mt-0.5"
                  />
                  <span>I understand this booking is held for me and I will pay {formatPrice(total)} when I arrive to class.</span>
                </label>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{success}</p>}

              <Button
                onClick={handleSubmit}
                className="h-12 w-full gap-2 text-base"
                disabled={isSubmitting || maxSeats <= 0}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                {isSubmitting ? "Booking..." : prepaid ? "Continue to Payment" : "Confirm Booking"}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </section>
      <Footer />
    </main>
  )
}

export default function ClassCheckoutPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <ClassCheckoutContent />
    </Suspense>
  )
}
