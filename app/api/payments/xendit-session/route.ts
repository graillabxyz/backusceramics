import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { formatPrice, workshops } from "@/lib/classes-data"
import {
  createXenditCustomerReference,
  createXenditPaymentSession,
  getXenditSecretKey,
  XenditApiError,
  XenditConfigurationError,
} from "@/lib/xendit"
import { getPaymentSessionExpiresAt } from "@/lib/payment-session"
import { checkRateLimit, isRequestBodyTooLarge, rateLimitHeaders } from "@/lib/server-security"
import {
  classSeatPoolKey,
  buildDefaultRangeSessions,
  buildRangeSessionsFromSchedules,
  type CalendarSession,
  getScheduleOffering,
  hasSessionStartPassed,
  normalizeTimeLabel,
  parseDateKey,
} from "@/lib/class-schedule"
import { recordAnalyticsEvent } from "@/lib/analytics-server"
import type { Prisma } from "@prisma/client"
import { getTrustedRequestOrigin } from "@/lib/request-origin"
import { activeSeatBookingWhere, calculateSeatUsage, lockClassSeatPools } from "@/lib/class-seat-accounting"

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

type SeatAvailabilityDb = Pick<Prisma.TransactionClient, "classSchedule" | "classBooking" | "classHold">

class SeatReservationConflict extends Error {}

function resolveSlotWorkshopId(parentWorkshop: (typeof workshops)[number], requestedSlotWorkshopId?: string) {
  if (!requestedSlotWorkshopId) return parentWorkshop.id
  if (parentWorkshop.category !== "residency") {
    return requestedSlotWorkshopId === parentWorkshop.id ? parentWorkshop.id : null
  }

  return ["beginner-wheel", "handbuilding"].includes(requestedSlotWorkshopId)
    ? requestedSlotWorkshopId
    : null
}

async function isPublishedMeeting({
  dateKey,
  timeLabel,
  workshopId,
  scheduleId,
}: {
  dateKey: string
  timeLabel: string
  workshopId: string
  scheduleId?: string | null
}) {
  const date = parseDateKey(dateKey)
  const schedules = await prisma.classSchedule.findMany({
    where: {
      status: "ACTIVE",
      startDate: { lte: date },
      OR: [{ endDate: null }, { endDate: { gte: date } }],
    },
  })
  const sessions: CalendarSession[] = [
    ...buildDefaultRangeSessions(date, date),
    ...buildRangeSessionsFromSchedules(date, date, schedules),
  ]

  return sessions.some((session) => (
    session.workshop.id === workshopId &&
    session.dateKey === dateKey &&
    normalizeTimeLabel(session.timeLabel) === normalizeTimeLabel(timeLabel) &&
    (!scheduleId || session.scheduleId === scheduleId)
  ))
}

function markPaymentStep(trace: PaymentTrace | undefined, step: string) {
  if (trace) trace.step = step
}

function tagPaymentResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store")
  return response
}

function sanitizeReference(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "booking"
}

function sanitizeCustomerName(value?: string | null) {
  return (value || "BackusCustomer").replace(/[^a-zA-Z0-9]/g, "").slice(0, 50) || "BackusCustomer"
}

function toE164OrUndefined(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return /^\+[1-9]\d{7,14}$/.test(trimmed) ? trimmed : undefined
}

function isHttpsUrl(value: string) {
  return value.startsWith("https://")
}

function getPaymentOrigin(req: NextRequest) {
  return getTrustedRequestOrigin(req)
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
  db = prisma,
}: {
  workshopId: string
  scheduleId?: string | null
  dateKey: string
  timeLabel: string
  fallbackCapacity: number
  db?: SeatAvailabilityDb
}) {
  const sessionDate = parseDateKey(dateKey)
  let schedule = null
  if (scheduleId) {
    try {
      schedule = await db.classSchedule.findUnique({ where: { id: scheduleId } })
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
    existingBookings = await db.classBooking.findMany({
      where: {
        ...activeSeatBookingWhere(),
        preferredDate: { startsWith: dateKey },
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

  let holds: { id: string; timeLabel: string; seats: number; weekdays: string; startDate: Date; endDate: Date | null }[] = []
  try {
    holds = await db.classHold.findMany({
      where: {
        status: "ACTIVE",
        startDate: { lte: sessionDate },
        OR: [{ endDate: null }, { endDate: { gte: sessionDate } }],
      },
      select: {
        id: true,
        timeLabel: true,
        seats: true,
        weekdays: true,
        startDate: true,
        endDate: true,
      },
    })
  } catch (error) {
    console.error("Could not load class holds while checking payment availability", {
      error,
      workshopId,
      dateKey,
      timeLabel,
    })
    throw error
  }

  const key = classSeatPoolKey(dateKey, timeLabel)
  const { bookedSeats, heldSeats } = calculateSeatUsage(
    [{ date: sessionDate, dateKey, timeLabel }],
    existingBookings,
    holds
  )

  return capacity - (bookedSeats.get(key) || 0) - (heldSeats.get(key) || 0)
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
    console.error("Xendit payment configuration is unavailable", { error })
    return NextResponse.json(
      { error: "Payment is temporarily unavailable. Please try again shortly.", code: paymentErrorCodes.configurationMissing },
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

      const slotWorkshopId = resolveSlotWorkshopId(workshop, meeting.slotWorkshopId)
      if (!slotWorkshopId) {
        return NextResponse.json(
          { error: "Selected studio slot does not belong to this program", code: paymentErrorCodes.invalidRequest },
          { status: 400 }
        )
      }
      const slotWorkshop = getScheduleOffering(slotWorkshopId) || workshops.find((item) => item.id === slotWorkshopId)
      if (!slotWorkshop) {
        return NextResponse.json(
          { error: "Selected studio slot was not found", code: paymentErrorCodes.invalidRequest },
          { status: 404 }
        )
      }

      if (!await isPublishedMeeting({
        dateKey: meeting.dateKey,
        timeLabel: meeting.timeLabel,
        workshopId: slotWorkshopId,
        scheduleId,
      })) {
        return NextResponse.json(
          {
            error: `${meeting.dateLabel || meeting.dateKey} at ${meeting.timeLabel} is not an available class time.`,
            code: paymentErrorCodes.invalidRequest,
          },
          { status: 409 }
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
  const holdExpiresAt = getPaymentSessionExpiresAt()
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
    createdBookings = await prisma.$transaction(async (tx) => {
      const bookingUser = session.user.email
        ? await tx.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
          })
        : null

      await lockClassSeatPools(
        tx,
        meetings.map((meeting) => classSeatPoolKey(meeting.dateKey, meeting.timeLabel))
      )

      for (const meeting of meetings) {
        const slotWorkshopId = resolveSlotWorkshopId(workshop, meeting.slotWorkshopId)
        if (!slotWorkshopId) throw new SeatReservationConflict("Selected studio slot does not belong to this program")
        const slotWorkshop = getScheduleOffering(slotWorkshopId) || workshops.find((item) => item.id === slotWorkshopId)
        if (!slotWorkshop) throw new SeatReservationConflict("Selected studio slot was not found")

        const availableSeats = await getAvailableSeats({
          workshopId: slotWorkshopId,
          scheduleId,
          dateKey: meeting.dateKey,
          timeLabel: meeting.timeLabel,
          fallbackCapacity: slotWorkshop.maxParticipants ?? maxParticipants,
          db: tx,
        })
        if (participants > availableSeats) {
          throw new SeatReservationConflict(
            `Only ${Math.max(availableSeats, 0)} ${availableSeats === 1 ? "seat is" : "seats are"} still available for ${meeting.dateLabel || meeting.dateKey} at ${meeting.timeLabel}.`
          )
        }
      }

      return Promise.all(meetings.map((meeting) =>
        tx.classBooking.create({
          data: {
            workshopId: resolveSlotWorkshopId(workshop, meeting.slotWorkshopId) || workshopId,
            ...(bookingScheduleId ? { scheduleId: bookingScheduleId } : {}),
            userId: bookingUser?.id ?? null,
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
      ))
    }, { timeout: 10_000 })
  } catch (error) {
    console.error("Could not reserve booking before Xendit payment with Prisma", {
      error,
      workshopId,
      scheduleId,
      meetingCount: meetings.length,
    })
    if (error instanceof SeatReservationConflict) {
      return NextResponse.json(
        { error: error.message, code: paymentErrorCodes.invalidRequest },
        { status: 409 }
      )
    }
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
      expires_at: holdExpiresAt.toISOString(),
      customer: {
        reference_id: createXenditCustomerReference(session.user.id || session.user.email, referenceId),
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
        error: "Payment could not be started right now. Please try again shortly or message us on WhatsApp.",
        code: isConfigError ? paymentErrorCodes.configurationMissing : paymentErrorCodes.xenditInvoiceFailed,
      },
      { status: isConfigError ? 503 : 502 }
    )
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, { key: "class-payment", limit: 10, windowMs: 10 * 60_000 })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please wait a few minutes and try again.", code: "PAYMENT_RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders(rateLimit.retryAfterSeconds) }
    )
  }

  const trace: PaymentTrace = {
    step: "received",
    startedAt: Date.now(),
  }

  try {
    const response = await handlePaymentSessionPost(req, trace)
    return tagPaymentResponse(response)
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
      },
      { status: 500 }
    ))
  }
}
