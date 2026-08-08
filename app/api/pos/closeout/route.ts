import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { buildPosCloseoutReport, sendPosCloseoutReportEmail } from "@/lib/pos-closeout"
import { calculatePosCashReconciliation, type PosCashExpense } from "@/lib/pos-cash-reconciliation"
import { POS_PIN_LOCK_SECONDS } from "@/lib/pos-pin"
import { cleanString, isRequestBodyTooLarge, safeHeaderValue } from "@/lib/server-security"
import { getPosOperatorFromRequest, setPosOperatorCookie } from "@/lib/pos-operator-session"

const MAX_POS_CLOSEOUT_BODY_BYTES = 32 * 1024
const MAX_CASH_AMOUNT = 2_000_000_000
const MAX_CASH_EXPENSES = 30

function parseCashAmount(value: unknown, label: string) {
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_CASH_AMOUNT) {
    throw new Error(`${label} must be a whole IDR amount between 0 and ${MAX_CASH_AMOUNT}.`)
  }
  return amount
}

function parseCashExpenses(value: unknown): PosCashExpense[] {
  if (!Array.isArray(value)) return []
  if (value.length > MAX_CASH_EXPENSES) throw new Error(`Add no more than ${MAX_CASH_EXPENSES} cash expenses.`)

  return value.map((expense, index) => {
    if (!expense || typeof expense !== "object") throw new Error(`Cash expense ${index + 1} is invalid.`)
    const row = expense as Record<string, unknown>
    const description = typeof row.description === "string" ? cleanString(row.description, 160) : ""
    const amount = parseCashAmount(row.amount, `Cash expense ${index + 1}`)
    if (!description && amount > 0) throw new Error(`Add a description for cash expense ${index + 1}.`)
    return { description, amount }
  }).filter((expense) => expense.description || expense.amount > 0)
}

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
  let cash
  try {
    cash = calculatePosCashReconciliation({
      openingCash: parseCashAmount(data.openingCash ?? 0, "Opening cash"),
      cashSales: report.paymentBreakdown.find((item) => item.key === "CASH")?.total || 0,
      closingCash: parseCashAmount(data.closingCash ?? 0, "Closing cash"),
      cashExpenseItems: parseCashExpenses(data.cashExpenseItems),
    })
  } catch (cashError) {
    return NextResponse.json(
      { error: cashError instanceof Error ? cashError.message : "Cash reconciliation is invalid." },
      { status: 400 },
    )
  }

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
      openingCash: cash.openingCash,
      cashSales: cash.cashSales,
      cashExpenses: cash.cashExpenses,
      cashExpenseItems: JSON.stringify(cash.cashExpenseItems),
      expectedClosingCash: cash.expectedClosingCash,
      closingCash: cash.closingCash,
      cashVariance: cash.cashVariance,
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
      openingCash: cash.openingCash,
      cashSales: cash.cashSales,
      cashExpenses: cash.cashExpenses,
      cashExpenseItems: JSON.stringify(cash.cashExpenseItems),
      expectedClosingCash: cash.expectedClosingCash,
      closingCash: cash.closingCash,
      cashVariance: cash.cashVariance,
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

  const emailSent = data.emailReport ? await sendPosCloseoutReportEmail(report, cash, reportEmail, notes) : false

  const response = NextResponse.json({ report, closeout, cash, emailSent })
  setPosOperatorCookie(response, posOperator.id, POS_PIN_LOCK_SECONDS)
  return response
}
