"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, CalendarDays, Clock, Loader2, MessageCircle } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { BrandClosingSection } from "@/components/brand-closing-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CalendarExportButtons } from "@/components/calendar-export-buttons"
import { canExportCalendarEvent } from "@/lib/calendar-export"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"
import { formatPrice } from "@/lib/classes-data"
import { markCheckoutPaymentStarted, trackAnalyticsEvent } from "@/lib/client-analytics"

interface CheckoutMeeting {
  key: string
  dateKey: string
  dateLabel: string
  timeLabel: string
  slotWorkshopId?: string
  slotTitle?: string
  focus?: string
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

function safeInternalPath(value: string | null, fallback = "/classes/calendar") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback
  return value
}

function friendlyPaymentError(status: number, data: Record<string, unknown>) {
  const code = typeof data.code === "string" ? data.code : ""

  if (code === "PAYMENT_AUTH_FAILED") {
    return "Please sign in again before continuing to payment."
  }

  if (code === "PAYMENT_AVAILABILITY_CHECK_FAILED") {
    return "We could not confirm availability right now. Please refresh the calendar and try again."
  }

  if (code === "PAYMENT_RESERVATION_FAILED") {
    return "We could not hold those seats just now. Please refresh the calendar and choose the time again."
  }

  if (code === "PAYMENT_CONFIGURATION_MISSING" || code === "PAYMENT_XENDIT_INVOICE_FAILED" || status >= 500) {
    return "Payment could not be started right now. Please try again shortly or message us on WhatsApp."
  }

  return "We could not start this booking. Please refresh and try again."
}

function ClassCheckoutContent() {
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading: authLoading, openAuthModal } = useAuth()
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
  const focus = searchParams.get("focus") || ""
  const returnTo = safeInternalPath(searchParams.get("returnTo"))
  const returnLabel = searchParams.get("returnLabel") || "Back to calendar"
  const bookingSource = searchParams.get("source") || ""
  const calendarEvents = useMemo(() => {
    if (prepaid) {
      return meetings
        .filter((meeting) => canExportCalendarEvent(meeting))
        .map((meeting) => ({
          title: `${title} at Backus Ceramics`,
          dateKey: meeting.dateKey,
          timeLabel: meeting.timeLabel,
          description: meeting.slotTitle ? `${meeting.slotTitle} · Backus Ceramics booking` : "Backus Ceramics booking",
        }))
    }

    if (!canExportCalendarEvent({ dateKey, timeLabel })) return []
    return [{
      title: `${title} at Backus Ceramics`,
      dateKey,
      timeLabel,
      description: "Backus Ceramics booking",
    }]
  }, [dateKey, meetings, prepaid, timeLabel, title])

  const [people, setPeople] = useState(initialSeats.toString())
  const [whatsappPhone, setWhatsappPhone] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const selectedSeatCount = Number(people || 1)
  const total = price * selectedSeatCount
  const onsitePaymentWhatsAppUrl = `https://wa.me/6282145890402?text=${encodeURIComponent(
    `Hi! I'd like to arrange onsite payment for ${title} on ${dateLabel} at ${timeLabel}.`
  )}`
  const participantOptions = Array.from({ length: maxSeats }, (_, index) => index + 1)
  const paymentMeetings = prepaid
    ? meetings
    : dateKey && timeLabel
      ? [{
          key: `${dateKey}|${timeLabel}`,
          dateKey,
          dateLabel,
          timeLabel,
        }]
      : []
  const paymentRequiredMeetings = prepaid ? requiredMeetings : 1
  const startingMeeting = prepaid ? meetings[0] : null
  const uniqueMeetingTimes = useMemo(() => Array.from(new Set(meetings.map((meeting) => meeting.timeLabel))), [meetings])
  const hasMixedMeetingTimes = prepaid && uniqueMeetingTimes.length > 1
  const isCheckingSignIn = authLoading && !isAuthenticated
  const analyticsContext = () => ({
    path: typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : `/classes/checkout?${searchParams.toString()}`,
    source: bookingSource || undefined,
    workshopId,
    workshopTitle: title,
    scheduleId: scheduleId || undefined,
    value: total,
    metadata: {
      participants: selectedSeatCount,
      meetingCount: paymentMeetings.length,
      requiredMeetings: paymentRequiredMeetings,
      prepaid,
      dateKey,
      dateLabel,
      timeLabel,
      focus: focus || undefined,
    },
  })

  const handleSubmit = async () => {
    setError("")
    setSuccess("")
    void trackAnalyticsEvent({
      type: "payment_intent_click",
      ...analyticsContext(),
    })

    if (isCheckingSignIn) {
      void trackAnalyticsEvent({
        type: "payment_validation_failed",
        ...analyticsContext(),
        metadata: { ...analyticsContext().metadata, reason: "auth_resolving" },
      })
      setError("We are finishing your sign-in. Please wait a moment.")
      return
    }

    if (!isAuthenticated) {
      void trackAnalyticsEvent({
        type: "payment_login_required",
        ...analyticsContext(),
      })
      openAuthModal(`/classes/checkout?${searchParams.toString()}`)
      return
    }

    if (!whatsappPhone.trim()) {
      void trackAnalyticsEvent({
        type: "payment_validation_failed",
        ...analyticsContext(),
        metadata: { ...analyticsContext().metadata, reason: "missing_whatsapp" },
      })
      setError("Enter your WhatsApp phone number.")
      return
    }

    if (paymentRequiredMeetings > 0 && paymentMeetings.length !== paymentRequiredMeetings) {
      void trackAnalyticsEvent({
        type: "payment_validation_failed",
        ...analyticsContext(),
        metadata: { ...analyticsContext().metadata, reason: "wrong_meeting_count" },
      })
      setError(`This booking needs ${paymentRequiredMeetings} available ${paymentRequiredMeetings === 1 ? "class time" : "program days"} before payment.`)
      return
    }

    if (paymentMeetings.length === 0) {
      void trackAnalyticsEvent({
        type: "payment_validation_failed",
        ...analyticsContext(),
        metadata: { ...analyticsContext().metadata, reason: "missing_meetings" },
      })
      setError("Return to the calendar and choose your class time.")
      return
    }

    setIsSubmitting(true)
    try {
      const returnPath = `${window.location.pathname}${window.location.search}`
      void trackAnalyticsEvent({
        type: "payment_start_request",
        ...analyticsContext(),
      })
      const res = await fetch("/api/payments/xendit-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workshopId,
          scheduleId: scheduleId || null,
          participants: selectedSeatCount,
          contactPhone: whatsappPhone.trim(),
          meetings: paymentMeetings,
          requiredMeetings: paymentRequiredMeetings,
          focus,
          source: bookingSource,
          returnPath,
        }),
      })

      const responseText = await res.text()
      let data: Record<string, unknown> = {}
      try {
        data = responseText ? JSON.parse(responseText) : {}
      } catch {
        data = { rawResponse: responseText.slice(0, 1000) }
      }
      if (!res.ok) {
        void trackAnalyticsEvent({
          type: "payment_start_failed",
          ...analyticsContext(),
          metadata: {
            ...analyticsContext().metadata,
            status: res.status,
            code: typeof data.code === "string" ? data.code : undefined,
          },
        })
        console.error("Payment start failed", {
          status: res.status,
          response: data,
          request: {
            workshopId,
            scheduleId: scheduleId || null,
            participants: selectedSeatCount,
            meetingCount: paymentMeetings.length,
            requiredMeetings: paymentRequiredMeetings,
            source: bookingSource,
          },
        })
        console.error("Payment start failed details", JSON.stringify({
          status: res.status,
          response: data,
          request: {
            workshopId,
            scheduleId: scheduleId || null,
            participants: selectedSeatCount,
            meetingCount: paymentMeetings.length,
            requiredMeetings: paymentRequiredMeetings,
            source: bookingSource,
          },
        }, null, 2))
        throw new Error(friendlyPaymentError(res.status, data as Record<string, unknown>))
      }

      const paymentUrl = typeof data.paymentUrl === "string" ? data.paymentUrl : ""
      if (!paymentUrl) {
        void trackAnalyticsEvent({
          type: "payment_start_failed",
          ...analyticsContext(),
          metadata: { ...analyticsContext().metadata, reason: "missing_payment_url" },
        })
        console.error("Payment response missing paymentUrl", {
          response: data,
          request: {
            workshopId,
            scheduleId: scheduleId || null,
            participants: selectedSeatCount,
            meetingCount: paymentMeetings.length,
            source: bookingSource,
          },
        })
        console.error("Payment response missing paymentUrl details", JSON.stringify({
          response: data,
          request: {
            workshopId,
            scheduleId: scheduleId || null,
            participants: selectedSeatCount,
            meetingCount: paymentMeetings.length,
            source: bookingSource,
          },
        }, null, 2))
        throw new Error("Payment could not be started right now. Please try again shortly or message us on WhatsApp.")
      }

      markCheckoutPaymentStarted(returnPath)
      await trackAnalyticsEvent({
        type: "payment_start_success",
        ...analyticsContext(),
        metadata: {
          ...analyticsContext().metadata,
          referenceId: typeof data.referenceId === "string" ? data.referenceId : undefined,
          paymentSessionId: typeof data.paymentSessionId === "string" ? data.paymentSessionId : undefined,
          bookingIds: Array.isArray(data.bookingIds) ? data.bookingIds : undefined,
          holdExpiresAt: typeof data.holdExpiresAt === "string" ? data.holdExpiresAt : undefined,
        },
      }, { beacon: true })
      window.location.href = paymentUrl
    } catch (paymentError) {
      console.error("Payment checkout error", paymentError)
      void trackAnalyticsEvent({
        type: "payment_checkout_error",
        ...analyticsContext(),
        metadata: {
          ...analyticsContext().metadata,
          message: paymentError instanceof Error ? paymentError.message : "Unknown checkout error",
        },
      })
      setError(paymentError instanceof Error ? paymentError.message : "We could not start this booking. Please refresh and try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Navigation />
      <section className="border-b border-border bg-secondary/25 pt-24 pb-6">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-4">
            <Button variant="ghost" asChild className="gap-2 px-0">
              <Link href={returnTo}>
                <ArrowLeft className="h-4 w-4" />
                {returnLabel}
              </Link>
            </Button>
          </div>
          <Badge variant="secondary" className="mb-3">Checkout</Badge>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Review your booking.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Check the details, add your WhatsApp number, then continue to secure payment.
              </p>
            </div>
            <div className="flex w-fit rounded-md border border-border bg-background p-1 text-xs font-medium text-muted-foreground">
              <span className="px-2.5 py-1">1. Choose</span>
              <span className="rounded bg-primary px-2.5 py-1 text-primary-foreground">2. Review</span>
              <span className="px-2.5 py-1">3. Confirm</span>
            </div>
          </div>
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
                  <p className="text-sm font-semibold text-foreground">{focus ? "Residency days" : "Workshop days"}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {focus
                      ? "These days reserve the studio slots shown below."
                      : "You chose the starting day. We automatically selected the required workshop dates below, so please review every date and time before continuing."}
                  </p>
                  {!focus && startingMeeting && (
                    <p className="mt-2 text-xs font-medium text-foreground">
                      Starting day: {startingMeeting.dateLabel} · {startingMeeting.timeLabel}
                    </p>
                  )}
                  {!focus && (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {hasMixedMeetingTimes
                        ? "Some days use a different time because the original time slot was not available for the full workshop sequence."
                        : "All selected workshop days are at the same time."}
                    </p>
                  )}
                  {focus && (
                    <p className="mt-2 text-xs font-medium text-foreground">
                      Focus: {focus}
                    </p>
                  )}
                  <div className="mt-3 space-y-2">
                    {meetings.map((meeting) => (
                      <div key={meeting.key} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/60 px-3 py-2 text-sm">
                        <span className="font-medium text-foreground">{meeting.dateLabel}</span>
                        <span className="text-right text-muted-foreground">
                          {meeting.slotTitle ? `${meeting.slotTitle} · ` : ""}{meeting.timeLabel}
                        </span>
                      </div>
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
                    <span>Total due today</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>
              </div>

              <p className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground">
                Online payment confirms your seat immediately. We will hold the selected {paymentMeetings.length === 1 ? "class time" : "program days"} for 5 minutes while you complete secure payment through Xendit.
              </p>

              <div className="rounded-md border border-border bg-background p-3 text-sm leading-relaxed text-muted-foreground">
                Need to arrange payment at the studio instead? Message us on WhatsApp before coming in so we can confirm that the class time is still available.
                <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
                  <a href={onsitePaymentWhatsAppUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Ask about onsite payment
                  </a>
                </Button>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{success}</p>}

              {success && calendarEvents.length > 0 && (
                <div className="space-y-3 rounded-md border border-border bg-muted/35 p-3">
                  <p className="text-sm font-semibold text-foreground">Add {calendarEvents.length === 1 ? "this class" : "these dates"} to your calendar</p>
                  <div className="space-y-2">
                    {calendarEvents.map((event) => (
                      <div key={`${event.dateKey}-${event.timeLabel}`} className="space-y-2">
                        {calendarEvents.length > 1 && (
                          <p className="text-xs font-medium text-muted-foreground">
                            {event.dateKey} · {event.timeLabel}
                          </p>
                        )}
                        <CalendarExportButtons event={event} compact />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                className="h-12 w-full gap-2 text-base"
                disabled={isSubmitting || isCheckingSignIn || maxSeats <= 0}
              >
                {isSubmitting || isCheckingSignIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                {isSubmitting ? "Starting Payment..." : isCheckingSignIn ? "Checking sign-in..." : "Continue to Payment"}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </section>
      <BrandClosingSection
        eyebrow="Studio note"
        title="Your seat matters in a small studio."
        body="Our classes are intentionally limited so every student has space, tools, and attention. Once confirmed, your booking helps us prepare the room and protect that time for you."
      />
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
