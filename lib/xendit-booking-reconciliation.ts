import { prisma } from "@/lib/prisma"
import { recordAnalyticsEvent } from "@/lib/analytics-server"
import { notifyClassBookingsConfirmed } from "@/lib/admin-notification-events"
import { getXenditPaymentSession } from "@/lib/xendit"
import { mapInvoiceStatusToBookingStatus } from "@/lib/xendit-webhook"

const RECONCILIATION_LOOKBACK_HOURS = 72

type ReconcileRecentBookingsInput = {
  isAdmin: boolean
  userId?: string | null
  email?: string | null
  paymentReference?: string | null
  maxSessions?: number
}

export function isMatchingXenditClassPayment({
  paymentSessionId,
  paymentReference,
  remotePaymentSessionId,
  remoteReference,
  remoteSessionType,
  remoteCurrency,
}: {
  paymentSessionId: string
  paymentReference: string
  remotePaymentSessionId: string
  remoteReference: string
  remoteSessionType?: string
  remoteCurrency?: string
}) {
  return (
    remotePaymentSessionId === paymentSessionId &&
    remoteReference === paymentReference &&
    (!remoteSessionType || remoteSessionType.toUpperCase() === "PAY") &&
    (!remoteCurrency || remoteCurrency.toUpperCase() === "IDR")
  )
}

async function reconcilePaymentSession({
  paymentSessionId,
  paymentReference,
}: {
  paymentSessionId: string
  paymentReference: string
}) {
  const remoteSession = await getXenditPaymentSession(paymentSessionId)
  const isMatch = isMatchingXenditClassPayment({
    paymentSessionId,
    paymentReference,
    remotePaymentSessionId: remoteSession.payment_session_id,
    remoteReference: remoteSession.reference_id,
    remoteSessionType: remoteSession.session_type,
    remoteCurrency: remoteSession.currency,
  })

  if (!isMatch) {
    console.error("Xendit booking reconciliation rejected mismatched session identity", {
      paymentSessionId,
      paymentReference,
      remotePaymentSessionId: remoteSession.payment_session_id,
      remoteReference: remoteSession.reference_id,
    })
    return { updated: 0, status: null }
  }

  const bookingStatus = mapInvoiceStatusToBookingStatus(remoteSession.status)
  if (!bookingStatus) return { updated: 0, status: remoteSession.status }

  const where = {
    paymentSessionId,
    paymentReference,
    status: "PENDING",
  }
  const result = await prisma.classBooking.updateMany({
    where,
    data: {
      status: bookingStatus,
      holdExpiresAt: null,
      ...(bookingStatus === "CONFIRMED"
        ? { confirmedAt: new Date(), cancelledAt: null }
        : { cancelledAt: new Date() }),
    },
  })

  await recordAnalyticsEvent({
    type: bookingStatus === "CONFIRMED" ? "payment_completed" : "payment_cancelled",
    source: "xendit_status_reconciliation",
    metadata: {
      bookingStatus,
      paymentReference,
      paymentSessionId,
      remoteStatus: remoteSession.status,
      updated: result.count,
    },
  })

  if (bookingStatus === "CONFIRMED" && result.count > 0) {
    const confirmedBookings = await prisma.classBooking.findMany({
      where: {
        paymentSessionId,
        paymentReference,
        status: "CONFIRMED",
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    })
    await notifyClassBookingsConfirmed(confirmedBookings)
  }

  return { updated: result.count, status: bookingStatus }
}

export async function reconcileRecentXenditClassBookings({
  isAdmin,
  userId,
  email,
  paymentReference,
  maxSessions = 4,
}: ReconcileRecentBookingsInput) {
  const normalizedReference = paymentReference?.trim().slice(0, 255) || null
  const recentCutoff = new Date(Date.now() - RECONCILIATION_LOOKBACK_HOURS * 60 * 60 * 1000)
  const ownership = isAdmin
    ? {}
    : {
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(email ? [{ contactEmail: email }] : []),
        ],
      }

  if (!isAdmin && !userId && !email) return { checked: 0, updated: 0 }

  const candidates = await prisma.classBooking.findMany({
    where: {
      status: "PENDING",
      paymentSessionId: { not: null },
      paymentReference: normalizedReference ? normalizedReference : { not: null },
      createdAt: { gte: recentCutoff },
      ...ownership,
    },
    orderBy: { createdAt: "desc" },
    distinct: ["paymentSessionId"],
    take: Math.min(Math.max(maxSessions, 1), 8),
    select: {
      paymentReference: true,
      paymentSessionId: true,
    },
  })

  const outcomes = await Promise.all(candidates.map(async (candidate) => {
    if (!candidate.paymentSessionId || !candidate.paymentReference) return { updated: 0 }

    try {
      return await reconcilePaymentSession({
        paymentSessionId: candidate.paymentSessionId,
        paymentReference: candidate.paymentReference,
      })
    } catch (error) {
      console.error("Could not reconcile pending class booking with Xendit", {
        error,
        paymentSessionId: candidate.paymentSessionId,
        paymentReference: candidate.paymentReference,
      })
      return { updated: 0 }
    }
  }))

  return {
    checked: candidates.length,
    updated: outcomes.reduce((total, outcome) => total + outcome.updated, 0),
  }
}
