import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { formatPrice, workshops } from "@/lib/classes-data"
import {
  getScheduleOffering,
  hasSessionStartPassed,
  parseDateKey,
  parsePreferredDate,
  parseWeekdays,
  sessionKey,
} from "@/lib/class-schedule"

export const runtime = "nodejs"

const paymentErrorCodes = {
  configurationMissing: "PAYMENT_CONFIGURATION_MISSING",
  invalidRequest: "PAYMENT_INVALID_REQUEST",
  availabilityCheckFailed: "PAYMENT_AVAILABILITY_CHECK_FAILED",
  reservationFailed: "PAYMENT_RESERVATION_FAILED",
  xenditInvoiceFailed: "PAYMENT_XENDIT_INVOICE_FAILED",
  authFailed: "PAYMENT_AUTH_FAILED",
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

function getOrigin(req: NextRequest) {
  return req.headers.get("origin") || req.nextUrl.origin
}

function isHttpsUrl(value: string) {
  return value.startsWith("https://")
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
  const schedule = scheduleId
    ? await prisma.classSchedule.findUnique({ where: { id: scheduleId } })
    : null
  const capacity = schedule?.maxParticipants ?? fallbackCapacity

  const [existingBookings, holds] = await Promise.all([
    prisma.classBooking.findMany({
      where: {
        workshopId,
        status: { in: ["PENDING", "CONFIRMED"] },
        preferredDate: { startsWith: dateKey },
        ...(schedule ? { scheduleId: schedule.id } : {}),
      },
      select: {
        preferredDate: true,
        participants: true,
      },
    }),
    prisma.classHold.findMany({
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
    }),
  ])

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

export async function POST(req: NextRequest) {
  let session: PaymentSession | null
  let attachLocalUserToBooking = true
  try {
    session = await auth()
  } catch (error) {
    console.error("Could not load authenticated user before Xendit payment", { error })
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

  const xenditKey = process.env.XENDIT_SECRET_KEY ?? process.env.XENDIT_KEY
  if (!xenditKey) {
    return NextResponse.json(
      { error: "Xendit is not configured yet", code: paymentErrorCodes.configurationMissing },
      { status: 503 }
    )
  }

  let data: Record<string, unknown>
  try {
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
  try {
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
  const origin = getOrigin(req)
  const hasHttpsOrigin = isHttpsUrl(origin)
  const contactPhone = typeof data.contactPhone === "string" ? data.contactPhone.trim() : ""
  const paymentNote = [
    `Payment required via Xendit.`,
    `Payment reference: ${referenceId}.`,
    `Program: ${workshop.title}.`,
    data.focus ? `Focus: ${data.focus}.` : "",
    `Covers ${meetings.length} studio ${meetings.length === 1 ? "day" : "days"}.`,
    `Total due today: ${formatPrice(total)}.`,
  ].filter(Boolean).join(" ")

  let createdBookings = []
  try {
    createdBookings = await prisma.$transaction(
      meetings.map((meeting) =>
        prisma.classBooking.create({
          data: {
            workshopId: meeting.slotWorkshopId || workshopId,
            scheduleId,
            userId: attachLocalUserToBooking ? session.user.id : null,
            preferredDate: `${meeting.dateKey} · ${meeting.timeLabel}`,
            participants,
            notes: meeting.slotTitle ? `${paymentNote} Reserved slot: ${meeting.slotTitle}.` : paymentNote,
            contactName: session.user.name || "",
            contactEmail: session.user.email || "",
            contactPhone: contactPhone || null,
          },
        })
      )
    )
  } catch (error) {
    console.error("Could not reserve booking before Xendit payment", {
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
    const xenditResponse = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${xenditKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_id: referenceId,
        amount: total,
        description: `${workshop.title} - ${participants} ${participants === 1 ? "seat" : "seats"}`,
        payer_email: session.user.email || undefined,
        invoice_duration: 1800,
        should_send_email: false,
        customer: {
          given_names: sanitizeCustomerName(session.user.name),
          email: session.user.email || undefined,
          mobile_number: toE164OrUndefined(contactPhone),
        },
        currency: "IDR",
        items: [
          {
            name: workshop.title,
            quantity: participants,
            price: workshop.price,
            category: "Ceramics class",
          },
        ],
        metadata: {
          booking_reference: referenceId,
          booking_ids: createdBookings.map((booking) => booking.id).join(","),
          workshop_id: workshop.id,
          workshop_days: meetings.map((meeting) => meeting.dateKey).join(","),
        },
        ...(hasHttpsOrigin
          ? {
              success_redirect_url: `${origin}/account/bookings?payment=success&reference=${referenceId}`,
              failure_redirect_url: `${origin}/classes/checkout?payment=cancelled`,
            }
          : {}),
      }),
    })

    const xenditData = await xenditResponse.json().catch(() => ({}))
    if (!xenditResponse.ok) {
      throw new Error(xenditData?.message || xenditData?.error_code || "Could not start Xendit payment")
    }

    const paymentUrl = xenditData?.invoice_url
    if (typeof paymentUrl !== "string" || !paymentUrl) {
      throw new Error("Xendit did not return a payment link")
    }

    return NextResponse.json({
      paymentUrl,
      referenceId,
      bookingIds: createdBookings.map((booking) => booking.id),
    })
  } catch (error) {
    console.error("Could not start Xendit invoice payment", {
      error,
      workshopId,
      referenceId,
      bookingIds: createdBookings.map((booking) => booking.id),
    })
    try {
      await prisma.classBooking.updateMany({
        where: { id: { in: createdBookings.map((booking) => booking.id) } },
        data: { status: "CANCELLED" },
      })
    } catch (rollbackError) {
      console.error("Could not cancel reserved bookings after Xendit failure", rollbackError)
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not start payment",
        code: paymentErrorCodes.xenditInvoiceFailed,
      },
      { status: 502 }
    )
  }
}
