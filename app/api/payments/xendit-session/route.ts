import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { formatPrice, workshops } from "@/lib/classes-data"
import {
  createXenditPaymentSession,
  getXenditSecretKey,
  XenditApiError,
  XenditConfigurationError,
} from "@/lib/xendit"
import { isRequestBodyTooLarge } from "@/lib/server-security"
import {
  getScheduleOffering,
  hasSessionStartPassed,
  parseDateKey,
  parsePreferredDate,
  parseWeekdays,
  sessionKey,
} from "@/lib/class-schedule"
import { recordAnalyticsEvent } from "@/lib/analytics-server"

export const runtime = "nodejs"
const MAX_PAYMENT_SESSION_BODY_BYTES = 64 * 1024

const paymentErrorCodes = {
  configurationMissing: "PAYMENT_CONFIGURATION_MISSING",
  invalidRequest: "PAYMENT_INVALID_REQUEST",
  availabilityCheckFailed: "PAYMENT_AVAILABILITY_CHECK_FAILED",
  reservationFailed: "PAYMENT_RESERVATION_FAILED",
  xenditInvoiceFailed: "PAYMENT_XENDIT_INVOICE_FAILED",
  authFailed: "PAYMENT_AUTH_FAILED",
  unhandled: "PAYMENT_UNHANDLED_ERROR",
} as const

interface CheckoutMeeting {
  key?: string
  dateKey: string
  dateLabel?: string
  timeLabel: string
  slotWorkshopId?: string
  slotTitle?: string
  focus?: string
}

interface PaymentSession {
  user: {
    id: string | null
    email: string | null
    name: string | null
    image?: string | null
    role?: string
  }
}

interface ExistingBookingSeat {
  preferredDate: string | null
  participants: number
}

interface PaymentTrace {
  step: string
  startedAt: number
}

function markPaymentStep(trace: PaymentTrace | undefined, step: string) {
  if (trace) trace.step = step
}

function tagPaymentResponse(response: NextResponse, trace: PaymentTrace) {
  response.headers.set("x-payment-route-version", process.env.VERCEL_GIT_COMMIT_SHA || "local")
  response.headers.set("x-payment-route-step", trace.step)
  response.headers.set("x-payment-route-elapsed-ms", String(Date.now() - trace.startedAt))
  return response
}

function getPaymentHoldExpiresAt() {
  return new Date(Date.now() + 5 * 60 * 1000)
}

function activeBookingStatusWhere(now = new Date()) {
  return {
    OR: [
      { status: "CONFIRMED" },
      {
        status: "PENDING",
        OR: [
          { holdExpiresAt: null },
          { holdExpiresAt: { gt: now } },
        ],
      },
    ],
  }
}

function sanitizeReference(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "booking"
}

function sanitizeCustomerName(value?: string | null) {
  return (value || "BackusCustomer").replace(/[^a-zA-Z0-9]/g, "").slice(0, 50) || "BackusCustomer"
}

function sanitizeCustomerReference(value?: string | null) {
  return (value || "BackusCustomer").replace(/[^a-zA-Z0-9]/g, "").slice(0, 255) || "BackusCustomer"
}

function toE164OrUndefined(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return /^\+[1-9]\d{7,14}$/.test(trimmed) ? trimmed : undefined
}

function getOrigin(req: NextRequest) {
  return req.headers.get("origin") || req.nextUrl.origin
}

function isHttpsUrl(value: string) {
  return value.startsWith("https://")
}

function getPaymentOrigin(req: NextRequest) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "")
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim().replace(/\/$/, "")}`
    : ""
  const origin = getOrigin(req).replace(/\/$/, "")

  if (configuredSiteUrl && isHttpsUrl(configuredSiteUrl)) return configuredSiteUrl
  if (vercelProductionUrl && isHttpsUrl(vercelProductionUrl)) return vercelProductionUrl
  return origin
}

function safeInternalPath(value: unknown, fallback = "/classes/calendar") {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback
  if (trimmed.startsWith("/auth/callback")) return fallback
  return trimmed
}

function appendQueryParam(path: string, key: string, value: string) {
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

function parseMeetings(value: unknown): CheckoutMeeting[] {
  if (!Array.isArray(value)) return []

  return value.filter((item): item is CheckoutMeeting => {
    return (
      typeof item?.dateKey === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.dateKey) &&
      typeof item?.timeLabel === "string" &&
      item.timeLabel.trim().length > 0
    )
  })
}

async function getAvailableSeats({
  workshopId,
  scheduleId,
  dateKey,
  timeLabel,
  fallbackCapacity,
}: {
  workshopId: string
  scheduleId?: string | null
  dateKey: string
  timeLabel: string
  fallbackCapacity: number
}) {
  const sessionDate = parseDateKey(dateKey)
  let schedule = null
  if (scheduleId) {
    try {
      schedule = await prisma.classSchedule.findUnique({ where: { id: scheduleId } })
    } catch (error) {
      console.error("Could not load schedule while checking payment availability", {
        error,
        workshopId,
        scheduleId,
      })
    }
  }
  const capacity = schedule?.maxParticipants ?? fallbackCapacity

  let existingBookings: ExistingBookingSeat[] = []
  try {
    existingBookings = await prisma.classBooking.findMany({
      where: {
        workshopId,
        ...activeBookingStatusWhere(),
        preferredDate: { startsWith: dateKey },
        ...(schedule ? { scheduleId: schedule.id } : {}),
      },
      select: {
        preferredDate: true,
        participants: true,
      },
    })
  } catch (error) {
    console.error("Could not load bookings with Prisma while checking payment availability", {
      error,
      workshopId,
      dateKey,
      scheduleId: schedule?.id,
    })
    throw error
  }

  let holds: { seats: number; weekdays: string }[] = []
  try {
    holds = await prisma.classHold.findMany({
      where: {
        workshopId,
        timeLabel,
        status: "ACTIVE",
        startDate: { lte: sessionDate },
        OR: [{ endDate: null }, { endDate: { gte: sessionDate } }],
      },
      select: {
        seats: true,
        weekdays: true,
      },
    })
  } catch (error) {
    console.error("Could not load class holds while checking payment availability", {
      error,
      workshopId,
      dateKey,
      timeLabel,
    })
  }

  const key = sessionKey(workshopId, dateKey, timeLabel)
  const bookedSeats = existingBookings.reduce((sum, booking) => {
    const preferred = parsePreferredDate(booking.preferredDate)
    if (!preferred) return sum
    return sessionKey(workshopId, preferred.dateKey, preferred.timeLabel) === key
      ? sum + booking.participants
      : sum
  }, 0)

  const heldSeats = holds.reduce((sum, hold) => {
    return parseWeekdays(hold.weekdays).includes(sessionDate.getDay()) ? sum + hold.seats : sum
  }, 0)

  return capacity - bookedSeats - heldSeats
}

async function resolveScheduleIdForBooking(scheduleId: string | null) {
  if (!scheduleId) return null

  try {
    const schedule = await prisma.classSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true },
    })
    return schedule?.id ?? null
  } catch (error) {
    console.error("Could not resolve schedule before payment booking reservation", { error, scheduleId })
    return null
  }
}

async function handlePaymentSessionPost(req: NextRequest, trace?: PaymentTrace) {
  let session: PaymentSession | null
  let attachLocalUserToBooking = true
  try {
    markPaymentStep(trace, "auth")
    session = await auth()
  } catch (error) {
    console.error("Could not load authenticated user before Xendit payment", { error })
    markPaymentStep(trace, "supabase-auth-fallback")
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        {
          error: "Could not confirm your signed-in account before payment. Please refresh and try again.",
          code: paymentErrorCodes.authFailed,
        },
        { status: 500 }
      )
    }

    attachLocalUserToBooking = false
    session = {
      user: {
        id: null,
        email: user.email ?? null,
        name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        image: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        role: "USER",
      },
    }
  }

  if (!session) {
    return NextResponse.json({ error: "Must be signed in to pay for a booking" }, { status: 401 })
  }

  try {
    markPaymentStep(trace, "xendit-config")
    getXenditSecretKey()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xendit is not configured yet"
    return NextResponse.json(
      { error: message, code: paymentErrorCodes.configurationMissing },
      { status: 503 }
    )
  }

  let data: Record<string, unknown>
  try {
    markPaymentStep(trace, "parse-body")
    if (isRequestBodyTooLarge(req, MAX_PAYMENT_SESSION_BODY_BYTES)) {
      return NextResponse.json(
        { error: "Payment request is too large", code: paymentErrorCodes.invalidRequest },
        { status: 413 }
      )
    }
    data = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Payment request was not valid JSON", code: paymentErrorCodes.invalidRequest },
      { status: 400 }
    )
  }

  const workshopId = String(data.workshopId || "")
  const workshop = getScheduleOffering(workshopId) || workshops.find((item) => item.id === workshopId)
  if (!workshop) {
    return NextResponse.json(
      { error: "Workshop not found", code: paymentErrorCodes.invalidRequest },
      { status: 404 }
    )
  }

  const participants = Number(data.participants || 1)
  const maxParticipants = workshop.maxParticipants ?? 8
  if (!Number.isInteger(participants) || participants < 1 || participants > maxParticipants) {
    return NextResponse.json({ error: "Participant count is invalid" }, { status: 400 })
  }

  const meetings = parseMeetings(data.meetings)
  const requiredMeetings = Number(data.requiredMeetings || meetings.length)
  if (!Number.isInteger(requiredMeetings) || requiredMeetings < 1 || meetings.length !== requiredMeetings) {
    return NextResponse.json(
      { error: `This program needs ${requiredMeetings || 1} available workshop days before payment.` },
      { status: 400 }
    )
  }

  const dedupedMeetingKeys = new Set(meetings.map((meeting) => `${meeting.dateKey}|${meeting.timeLabel}`))
  if (dedupedMeetingKeys.size !== meetings.length) {
    return NextResponse.json({ error: "Duplicate workshop days cannot be booked" }, { status: 400 })
  }

  const scheduleId = typeof data.scheduleId === "string" && data.scheduleId ? data.scheduleId : null
  markPaymentStep(trace, "resolve-schedule")
  const bookingScheduleId = await resolveScheduleIdForBooking(scheduleId)
  try {
    markPaymentStep(trace, "availability")
    for (const meeting of meetings) {
      if (hasSessionStartPassed(meeting.dateKey, meeting.timeLabel)) {
        return NextResponse.json(
          {
            error: `${meeting.dateLabel || meeting.dateKey} at ${meeting.timeLabel} has already started and can no longer be booked.`,
            code: paymentErrorCodes.invalidRequest,
          },
          { status: 400 }
        )
      }

      const slotWorkshopId = meeting.slotWorkshopId || workshopId
      const slotWorkshop = getScheduleOffering(slotWorkshopId) || workshops.find((item) => item.id === slotWorkshopId)
      if (!slotWorkshop) {
        return NextResponse.json(
          { error: "Selected studio slot was not found", code: paymentErrorCodes.invalidRequest },
          { status: 404 }
        )
      }

      const availableSeats = await getAvailableSeats({
        workshopId: slotWorkshopId,
        scheduleId,
        dateKey: meeting.dateKey,
        timeLabel: meeting.timeLabel,
        fallbackCapacity: slotWorkshop.maxParticipants ?? maxParticipants,
      })

      if (participants > availableSeats) {
        return NextResponse.json(
          {
            error: `Only ${Math.max(availableSeats, 0)} ${availableSeats === 1 ? "seat is" : "seats are"} available for ${meeting.dateLabel || meeting.dateKey} at ${meeting.timeLabel}.`,
            code: paymentErrorCodes.invalidRequest,
          },
          { status: 409 }
        )
      }
    }
  } catch (error) {
    console.error("Could not validate availability before Xendit payment", {
      error,
      workshopId,
      scheduleId,
      meetingCount: meetings.length,
    })
    return NextResponse.json(
      {
        error: "Could not check class availability before payment. Please refresh and try again.",
        code: paymentErrorCodes.availabilityCheckFailed,
      },
      { status: 500 }
    )
  }

  const total = workshop.price * participants
  const referenceId = sanitizeReference(`bc_${Date.now()}_${workshop.id}`)
  const holdExpiresAt = getPaymentHoldExpiresAt()
  const origin = getPaymentOrigin(req)
  const hasHttpsOrigin = isHttpsUrl(origin)
  const returnPath = safeInternalPath(data.returnPath, "/classes/calendar")
  const contactPhone = typeof data.contactPhone === "string" ? data.contactPhone.trim() : ""
  const bookingSource = typeof data.source === "string" ? data.source : undefined
  const paymentNote = [
    `Payment required via Xendit.`,
    `Payment reference: ${referenceId}.`,
    `Program: ${workshop.title}.`,
    data.focus ? `Focus: ${data.focus}.` : "",
    `Covers ${meetings.length} studio ${meetings.length === 1 ? "day" : "days"}.`,
    `Total due today: ${formatPrice(total)}.`,
  ].filter(Boolean).join(" ")

  let createdBookings: { id: string }[] = []
  try {
    markPaymentStep(trace, "reservation-prisma")
    createdBookings = await prisma.$transaction(
      meetings.map((meeting) =>
        prisma.classBooking.create({
          data: {
            workshopId: meeting.slotWorkshopId || workshopId,
            ...(bookingScheduleId ? { scheduleId: bookingScheduleId } : {}),
            userId: attachLocalUserToBooking ? session.user.id : null,
            preferredDate: `${meeting.dateKey} · ${meeting.timeLabel}`,
            participants,
            notes: meeting.slotTitle ? `${paymentNote} Reserved slot: ${meeting.slotTitle}.` : paymentNote,
            paymentReference: referenceId,
            holdExpiresAt,
            contactName: session.user.name || "",
            contactEmail: session.user.email || "",
            contactPhone: contactPhone || null,
          },
        })
      )
    )
  } catch (error) {
    console.error("Could not reserve booking before Xendit payment with Prisma", {
      error,
      workshopId,
      scheduleId,
      meetingCount: meetings.length,
    })
    return NextResponse.json(
      {
        error: "Could not reserve those class seats before payment. Please refresh and try again.",
        code: paymentErrorCodes.reservationFailed,
      },
      { status: 500 }
    )
  }

  try {
    markPaymentStep(trace, "xendit-session")
    const paymentSession = await createXenditPaymentSession({
      reference_id: referenceId,
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount: total,
      currency: "IDR",
      country: "ID",
      description: `${workshop.title} - ${participants} ${participants === 1 ? "seat" : "seats"}`,
      allow_save_payment_method: "DISABLED",
      locale: "en",
      customer: {
        reference_id: sanitizeCustomerReference(session.user.id || session.user.email || referenceId),
        type: "INDIVIDUAL",
        email: session.user.email || undefined,
        mobile_number: toE164OrUndefined(contactPhone),
        individual_detail: {
          given_names: sanitizeCustomerName(session.user.name || session.user.email || "BackusCustomer"),
        },
      },
      items: [
        {
          reference_id: workshop.id,
          type: "PHYSICAL_SERVICE",
          name: workshop.title,
          net_unit_amount: workshop.price,
          quantity: participants,
          category: "Ceramics class",
        },
      ],
      metadata: {
        booking_reference: referenceId,
        booking_ids: createdBookings.map((booking) => booking.id).join(","),
        booking_reservation_status: "reserved",
        workshop_id: workshop.id,
        workshop_title: workshop.title,
        workshop_days: meetings.map((meeting) => meeting.dateKey).join(","),
        workshop_times: meetings.map((meeting) => meeting.timeLabel).join(","),
        schedule_id: scheduleId || undefined,
        focus: typeof data.focus === "string" ? data.focus : undefined,
        participants,
        customer_email: session.user.email || undefined,
        customer_phone: contactPhone || undefined,
      },
      ...(hasHttpsOrigin
        ? {
            success_return_url: `${origin}/account/bookings?payment=success&reference=${referenceId}`,
            cancel_return_url: `${origin}${appendQueryParam(returnPath, "payment", "cancelled")}`,
          }
        : {}),
    })

    try {
      await prisma.classBooking.updateMany({
        where: { id: { in: createdBookings.map((booking) => booking.id) } },
        data: { paymentSessionId: paymentSession.payment_session_id },
      })
    } catch (paymentSessionLinkError) {
      console.error("Could not attach Xendit payment session id to reserved bookings", {
        error: paymentSessionLinkError,
        referenceId,
        paymentSessionId: paymentSession.payment_session_id,
        bookingIds: createdBookings.map((booking) => booking.id),
      })
    }

    await recordAnalyticsEvent({
      type: "payment_session_created",
      path: returnPath,
      userId: session.user.id,
      workshopId: workshop.id,
      workshopTitle: workshop.title,
      scheduleId,
      source: bookingSource,
      value: total,
      currency: "IDR",
      metadata: {
        referenceId,
        paymentSessionId: paymentSession.payment_session_id,
        bookingIds: createdBookings.map((booking) => booking.id),
        participants,
        meetingCount: meetings.length,
        requiredMeetings,
        holdExpiresAt: holdExpiresAt.toISOString(),
      },
    }, req)

    return NextResponse.json({
      paymentUrl: paymentSession.payment_link_url,
      referenceId,
      paymentSessionId: paymentSession.payment_session_id,
      bookingIds: createdBookings.map((booking) => booking.id),
      holdExpiresAt: holdExpiresAt.toISOString(),
    })
  } catch (error) {
    const isXenditError = error instanceof XenditApiError
    const isConfigError = error instanceof XenditConfigurationError
    console.error("Could not start Xendit invoice payment", {
      error,
      xenditStatus: isXenditError ? error.status : undefined,
      xenditCode: isXenditError ? error.xenditCode : undefined,
      xenditResponseBody: isXenditError ? error.responseBody : undefined,
      workshopId,
      referenceId,
      bookingIds: createdBookings.map((booking) => booking.id),
    })
    try {
      if (createdBookings.length > 0) {
        markPaymentStep(trace, "reservation-rollback")
        await prisma.classBooking.updateMany({
          where: { id: { in: createdBookings.map((booking) => booking.id) } },
          data: { status: "CANCELLED", cancelledAt: new Date(), holdExpiresAt: null },
        })
      }
    } catch (rollbackError) {
      console.error("Could not cancel reserved bookings after Xendit failure", rollbackError)
    }

    await recordAnalyticsEvent({
      type: "payment_session_failed",
      path: returnPath,
      userId: session.user.id,
      workshopId: workshop.id,
      workshopTitle: workshop.title,
      scheduleId,
      source: bookingSource,
      value: total,
      currency: "IDR",
      metadata: {
        referenceId,
        bookingIds: createdBookings.map((booking) => booking.id),
        participants,
        meetingCount: meetings.length,
        xenditStatus: isXenditError ? error.status : undefined,
        xenditCode: isXenditError ? error.xenditCode : undefined,
        configurationError: isConfigError,
      },
    }, req)

	    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not start payment",
        code: isConfigError ? paymentErrorCodes.configurationMissing : paymentErrorCodes.xenditInvoiceFailed,
        xenditStatus: isXenditError ? error.status : undefined,
        xenditCode: isXenditError ? error.xenditCode : undefined,
        xenditMessage: isXenditError ? error.message : undefined,
      },
      { status: isConfigError ? 503 : 502 }
    )
  }
}

export async function POST(req: NextRequest) {
  const trace: PaymentTrace = {
    step: "received",
    startedAt: Date.now(),
  }

  try {
    const response = await handlePaymentSessionPost(req, trace)
    return tagPaymentResponse(response, trace)
  } catch (error) {
    console.error("Unhandled payment session route error", {
      error,
      message: error instanceof Error ? error.message : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      step: trace.step,
      elapsedMs: Date.now() - trace.startedAt,
    })

    return tagPaymentResponse(NextResponse.json(
      {
        error: "Payment could not be started right now. Please try again shortly or message us on WhatsApp.",
        code: paymentErrorCodes.unhandled,
        message: error instanceof Error ? error.message : undefined,
        step: trace.step,
        elapsedMs: Date.now() - trace.startedAt,
      },
      { status: 500 }
    ), trace)
  }
}
