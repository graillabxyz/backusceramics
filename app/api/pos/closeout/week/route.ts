import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { buildPosWeeklyCloseoutReport, sendPosWeeklyCloseoutReportEmail } from "@/lib/pos-closeout"
import { POS_PIN_LOCK_SECONDS } from "@/lib/pos-pin"
import { cleanString, isRequestBodyTooLarge, safeHeaderValue } from "@/lib/server-security"
import { getPosOperatorFromRequest, setPosOperatorCookie } from "@/lib/pos-operator-session"

const MAX_WEEKLY_CLOSEOUT_BODY_BYTES = 16 * 1024

async function authorize(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) return { error: "Unauthorized", status: 401 as const }
  const operator = await getPosOperatorFromRequest(req)
  if (!operator) return { error: "Unlock the POS with a cashier PIN to use weekly closeout.", status: 423 as const }
  return { session, operator }
}

export async function GET(req: NextRequest) {
  const access = await authorize(req)
  if ("error" in access) {
    return NextResponse.json({ error: access.error, code: access.status === 423 ? "POS_PIN_LOCKED" : undefined }, { status: access.status })
  }

  const report = await buildPosWeeklyCloseoutReport(req.nextUrl.searchParams.get("date"))
  const closeout = await prisma.posWeeklyCloseout.findUnique({
    where: { weekStart: report.weekStart },
    include: { closedBy: { select: { id: true, name: true, email: true } } },
  })
  const response = NextResponse.json({ report, closeout })
  setPosOperatorCookie(response, access.operator.id, POS_PIN_LOCK_SECONDS)
  return response
}

export async function POST(req: NextRequest) {
  const access = await authorize(req)
  if ("error" in access) {
    return NextResponse.json({ error: access.error, code: access.status === 423 ? "POS_PIN_LOCKED" : undefined }, { status: access.status })
  }
  if (isRequestBodyTooLarge(req, MAX_WEEKLY_CLOSEOUT_BODY_BYTES)) {
    return NextResponse.json({ error: "Weekly closeout payload is too large" }, { status: 413 })
  }

  const data = await req.json().catch(() => ({}))
  const report = await buildPosWeeklyCloseoutReport(typeof data.date === "string" ? data.date : null)
  const notes = typeof data.notes === "string" ? cleanString(data.notes, 3000) : ""
  const requestedEmail = typeof data.reportEmail === "string" ? safeHeaderValue(data.reportEmail, 254) : ""
  const reportEmail = requestedEmail || access.session.user.email || ""
  const snapshot = {
    weekEnd: report.weekEnd,
    closedAt: new Date(),
    closedById: access.operator.id,
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
    dailyBreakdown: JSON.stringify(report.dailyBreakdown),
    dailyCashBreakdown: JSON.stringify(report.dailyCashBreakdown),
    missingDailyCloseouts: JSON.stringify(report.missingDailyCloseouts),
    notes: notes || null,
  }
  const closeout = await prisma.posWeeklyCloseout.upsert({
    where: { weekStart: report.weekStart },
    create: { weekStart: report.weekStart, ...snapshot },
    update: snapshot,
    include: { closedBy: { select: { id: true, name: true, email: true } } },
  })
  const emailSent = data.emailReport ? await sendPosWeeklyCloseoutReportEmail(report, reportEmail, notes) : false
  const response = NextResponse.json({ report, closeout, emailSent })
  setPosOperatorCookie(response, access.operator.id, POS_PIN_LOCK_SECONDS)
  return response
}
