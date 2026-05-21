import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatPrice } from "@/lib/classes-data"
import {
  getScheduleOffering,
  parseDateKey,
  parsePreferredDate,
  parseWeekdays,
  sessionKey,
} from "@/lib/class-schedule"

export const runtime = "nodejs"

interface CheckoutMeeting {
  key?: string
  dateKey: string
  dateLabel?: string
  timeLabel: string
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
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Must be signed in to pay for a booking" }, { status: 401 })
  }

  const xenditKey = process.env.XENDIT_KEY
  if (!xenditKey) {
    return NextResponse.json({ error: "Xendit is not configured yet" }, { status: 503 })
  }

  const data = await req.json()
  const workshopId = String(data.workshopId || "")
  const workshop = getScheduleOffering(workshopId)
  if (!workshop) {
    return NextResponse.json({ error: "Workshop not found" }, { status: 404 })
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
  for (const meeting of meetings) {
    const availableSeats = await getAvailableSeats({
      workshopId,
      scheduleId,
      dateKey: meeting.dateKey,
      timeLabel: meeting.timeLabel,
      fallbackCapacity: maxParticipants,
    })

    if (participants > availableSeats) {
      return NextResponse.json(
        {
          error: `Only ${Math.max(availableSeats, 0)} ${availableSeats === 1 ? "seat is" : "seats are"} available for ${meeting.dateLabel || meeting.dateKey} at ${meeting.timeLabel}.`,
        },
        { status: 409 }
      )
    }
  }

  const total = workshop.price * participants
  const referenceId = sanitizeReference(`bc_${Date.now()}_${workshop.id}`)
  const origin = getOrigin(req)
  const hasHttpsOrigin = isHttpsUrl(origin)
  const contactPhone = typeof data.contactPhone === "string" ? data.contactPhone.trim() : ""
  const paymentNote = [
    `Payment required via Xendit.`,
    `Payment reference: ${referenceId}.`,
    `Covers ${meetings.length} workshop ${meetings.length === 1 ? "day" : "days"}.`,
    `Total due today: ${formatPrice(total)}.`,
  ].join(" ")

  const createdBookings = await prisma.$transaction(
    meetings.map((meeting) =>
      prisma.classBooking.create({
        data: {
          workshopId,
          scheduleId,
          userId: session.user.id,
          preferredDate: `${meeting.dateKey} · ${meeting.timeLabel}`,
          participants,
          notes: paymentNote,
          contactName: session.user.name || "",
          contactEmail: session.user.email || "",
          contactPhone: contactPhone || null,
        },
      })
    )
  )

  try {
    const xenditResponse = await fetch("https://api.xendit.co/sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${xenditKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reference_id: referenceId,
        session_type: "PAY",
        mode: "PAYMENT_LINK",
        amount: total,
        currency: "IDR",
        country: "ID",
        customer: {
          reference_id: sanitizeReference(session.user.id),
          type: "INDIVIDUAL",
          email: session.user.email || undefined,
          mobile_number: toE164OrUndefined(contactPhone),
          individual_detail: {
            given_names: sanitizeCustomerName(session.user.name),
          },
        },
        locale: "en",
        description: `${workshop.title} - ${participants} ${participants === 1 ? "seat" : "seats"}`,
        items: [
          {
            reference_id: workshop.id,
            type: "DIGITAL_SERVICE",
            name: workshop.title,
            net_unit_amount: workshop.price,
            quantity: participants,
            category: "Ceramics class",
            description: `${meetings.length} workshop ${meetings.length === 1 ? "day" : "days"}`,
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
              success_return_url: `${origin}/account/bookings?payment=success&reference=${referenceId}`,
              cancel_return_url: `${origin}/classes/checkout?payment=cancelled`,
            }
          : {}),
      }),
    })

    const xenditData = await xenditResponse.json().catch(() => ({}))
    if (!xenditResponse.ok) {
      throw new Error(xenditData?.message || "Could not start Xendit payment")
    }

    const paymentUrl = xenditData?.payment_link_url
    if (typeof paymentUrl !== "string" || !paymentUrl) {
      throw new Error("Xendit did not return a payment link")
    }

    return NextResponse.json({
      paymentUrl,
      referenceId,
      bookingIds: createdBookings.map((booking) => booking.id),
    })
  } catch (error) {
    await prisma.classBooking.updateMany({
      where: { id: { in: createdBookings.map((booking) => booking.id) } },
      data: { status: "CANCELLED" },
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start payment" },
      { status: 502 }
    )
  }
}
