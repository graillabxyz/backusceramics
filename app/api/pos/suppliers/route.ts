import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { POS_PIN_LOCK_SECONDS } from "@/lib/pos-pin"
import { getPosOperatorFromRequest, setPosOperatorCookie } from "@/lib/pos-operator-session"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"
import { normalizeSupplierName } from "@/lib/supplier-ledger"

const MAX_BODY_BYTES = 8 * 1024

async function authorize(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) return { error: "Unauthorized", status: 401 as const }
  const operator = await getPosOperatorFromRequest(req)
  if (!operator) return { error: "Unlock the POS with a cashier PIN to use supplier accounts.", status: 423 as const }
  return { session, operator }
}

export async function GET(req: NextRequest) {
  const access = await authorize(req)
  if ("error" in access) return NextResponse.json({ error: access.error, code: access.status === 423 ? "POS_PIN_LOCKED" : undefined }, { status: access.status })

  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1"
  const [suppliers, grouped, recentEntries] = await Promise.all([
    prisma.supplier.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, outletName: true, notes: true, active: true, createdAt: true, updatedAt: true },
    }),
    prisma.supplierLedgerEntry.groupBy({
      by: ["supplierId", "entryType"],
      where: { voidedAt: null },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.supplierLedgerEntry.findMany({
      orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        supplier: { select: { id: true, name: true, outletName: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        voidedBy: { select: { id: true, name: true, email: true } },
      },
    }),
  ])

  const totals = new Map<string, { billsTotal: number; paymentsTotal: number; billCount: number; paymentCount: number }>()
  for (const row of grouped) {
    const current = totals.get(row.supplierId) || { billsTotal: 0, paymentsTotal: 0, billCount: 0, paymentCount: 0 }
    if (row.entryType === "BILL") {
      current.billsTotal = row._sum.amount || 0
      current.billCount = row._count._all
    } else if (row.entryType === "PAYMENT") {
      current.paymentsTotal = row._sum.amount || 0
      current.paymentCount = row._count._all
    }
    totals.set(row.supplierId, current)
  }

  const accounts = suppliers.map((supplier) => {
    const account = totals.get(supplier.id) || { billsTotal: 0, paymentsTotal: 0, billCount: 0, paymentCount: 0 }
    return { ...supplier, ...account, balance: account.billsTotal - account.paymentsTotal }
  }).sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name) || (a.outletName || "").localeCompare(b.outletName || ""))
  const response = NextResponse.json({
    suppliers: accounts,
    recentEntries,
    summary: {
      supplierCount: accounts.length,
      billsTotal: accounts.reduce((sum, item) => sum + item.billsTotal, 0),
      paymentsTotal: accounts.reduce((sum, item) => sum + item.paymentsTotal, 0),
      outstanding: accounts.reduce((sum, item) => sum + Math.max(item.balance, 0), 0),
      supplierCredit: accounts.reduce((sum, item) => sum + Math.max(-item.balance, 0), 0),
      netBalance: accounts.reduce((sum, item) => sum + item.balance, 0),
    },
  })
  setPosOperatorCookie(response, access.operator.id, POS_PIN_LOCK_SECONDS)
  return response
}

export async function POST(req: NextRequest) {
  const access = await authorize(req)
  if ("error" in access) return NextResponse.json({ error: access.error, code: access.status === 423 ? "POS_PIN_LOCKED" : undefined }, { status: access.status })
  if (isRequestBodyTooLarge(req, MAX_BODY_BYTES)) return NextResponse.json({ error: "Supplier request is too large." }, { status: 413 })

  const data = await req.json().catch(() => ({}))
  const name = typeof data.name === "string" ? cleanString(data.name, 120) : ""
  const outletName = typeof data.outletName === "string" ? cleanString(data.outletName, 120) : ""
  const notes = typeof data.notes === "string" ? cleanString(data.notes, 1000) : ""
  if (name.length < 2) return NextResponse.json({ error: "Enter the supplier name." }, { status: 400 })

  try {
    const supplier = await prisma.supplier.create({
      data: {
        name,
        normalizedName: normalizeSupplierName(name),
        outletName: outletName || null,
        normalizedOutletName: normalizeSupplierName(outletName),
        notes: notes || null,
        createdById: access.operator.id,
      },
    })
    const response = NextResponse.json(supplier, { status: 201 })
    setPosOperatorCookie(response, access.operator.id, POS_PIN_LOCK_SECONDS)
    return response
  } catch (error) {
    console.error("Could not add POS supplier", { error, operatorId: access.operator.id })
    return NextResponse.json({ error: "That supplier outlet already exists or could not be added." }, { status: 409 })
  }
}
