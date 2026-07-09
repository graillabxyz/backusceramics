import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { buildPosCloseoutReport, sendPosCloseoutReportEmail } from "@/lib/pos-closeout"
import { cleanString, isRequestBodyTooLarge, safeHeaderValue } from "@/lib/server-security"

const MAX_POS_CLOSEOUT_BODY_BYTES = 32 * 1024

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

  return NextResponse.json({ report, closeout })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isRequestBodyTooLarge(req, MAX_POS_CLOSEOUT_BODY_BYTES)) {
    return NextResponse.json({ error: "Closeout payload is too large" }, { status: 413 })
  }

  const data = await req.json().catch(() => ({}))
  const report = await buildPosCloseoutReport(typeof data.date === "string" ? data.date : null)
  const notes = typeof data.notes === "string" ? cleanString(data.notes, 2000) : ""
  const requestedEmail = typeof data.reportEmail === "string" ? safeHeaderValue(data.reportEmail, 254) : ""
  const reportEmail = requestedEmail || session.user.email || ""

  const closeout = await prisma.posCloseout.upsert({
    where: { businessDate: report.businessDate },
    create: {
      businessDate: report.businessDate,
      closedById: session.user.id,
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
      closedById: session.user.id,
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

  return NextResponse.json({ report, closeout, emailSent })
}
