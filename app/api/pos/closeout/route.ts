import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { buildPosCloseoutReport, sendPosCloseoutReportEmail } from "@/lib/pos-closeout"
import { POS_PIN_LOCK_SECONDS } from "@/lib/pos-pin"
import { cleanString, isRequestBodyTooLarge, safeHeaderValue } from "@/lib/server-security"
import { getPosOperatorFromRequest, setPosOperatorCookie } from "@/lib/pos-operator-session"

const MAX_POS_CLOSEOUT_BODY_BYTES = 32 * 1024

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const posOperator = await getPosOperatorFromRequest(req)
  if (!posOperator) {
    return NextResponse.json({ error: "Unlock the POS with a cashier PIN to view closeout reports.", code: "POS_PIN_LOCKED" }, { status: 423 })
  }

  const dateKey = req.nextUrl.searchParams.get("date")
  const report = await buildPosCloseoutReport(dateKey)
  const closeout = await prisma.posCloseout.findUnique({
    where: { businessDate: report.businessDate },
    include: {
      closedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  const response = NextResponse.json({ report, closeout })
  setPosOperatorCookie(response, posOperator.id, POS_PIN_LOCK_SECONDS)
  return response
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const posOperator = await getPosOperatorFromRequest(req)
  if (!posOperator) {
    return NextResponse.json({ error: "Unlock the POS with a cashier PIN before closing the day.", code: "POS_PIN_LOCKED" }, { status: 423 })
  }

  if (isRequestBodyTooLarge(req, MAX_POS_CLOSEOUT_BODY_BYTES)) {
    return NextResponse.json({ error: "Closeout payload is too large" }, { status: 413 })
  }

  const data = await req.json().catch(() => ({}))
  const report = await buildPosCloseoutReport(typeof data.date === "string" ? data.date : null)
  const notes = typeof data.notes === "string" ? cleanString(data.notes, 2000) : ""
  const requestedEmail = typeof data.reportEmail === "string" ? safeHeaderValue(data.reportEmail, 254) : ""
  const reportEmail = requestedEmail || session.user.email || ""
  const closedById = posOperator.id

  const closeout = await prisma.posCloseout.upsert({
    where: { businessDate: report.businessDate },
    create: {
      businessDate: report.businessDate,
      closedById,
      saleCount: report.saleCount,
      itemCount: report.itemCount,
      grossSubtotal: report.grossSubtotal,
      discountTotal: report.discountTotal,
      taxTotal: report.taxTotal,
      netTotal: report.netTotal,
      voidedSaleCount: report.voidedSaleCount,
      voidedTotal: report.voidedTotal,
      pendingSaleCount: report.pendingSaleCount,
      pendingTotal: report.pendingTotal,
      paymentBreakdown: JSON.stringify(report.paymentBreakdown),
      categoryBreakdown: JSON.stringify(report.categoryBreakdown),
      operatorBreakdown: JSON.stringify(report.operatorBreakdown),
      notes: notes || null,
    },
    update: {
      closedAt: new Date(),
      closedById,
      saleCount: report.saleCount,
      itemCount: report.itemCount,
      grossSubtotal: report.grossSubtotal,
      discountTotal: report.discountTotal,
      taxTotal: report.taxTotal,
      netTotal: report.netTotal,
      voidedSaleCount: report.voidedSaleCount,
      voidedTotal: report.voidedTotal,
      pendingSaleCount: report.pendingSaleCount,
      pendingTotal: report.pendingTotal,
      paymentBreakdown: JSON.stringify(report.paymentBreakdown),
      categoryBreakdown: JSON.stringify(report.categoryBreakdown),
      operatorBreakdown: JSON.stringify(report.operatorBreakdown),
      notes: notes || null,
    },
    include: {
      closedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  const emailSent = data.emailReport ? await sendPosCloseoutReportEmail(report, reportEmail, notes) : false

  const response = NextResponse.json({ report, closeout, emailSent })
  setPosOperatorCookie(response, posOperator.id, POS_PIN_LOCK_SECONDS)
  return response
}
