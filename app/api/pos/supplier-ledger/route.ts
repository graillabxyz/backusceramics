import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { POS_PIN_LOCK_SECONDS } from "@/lib/pos-pin"
import { getPosOperatorFromRequest, setPosOperatorCookie } from "@/lib/pos-operator-session"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"
import { SUPPLIER_ENTRY_TYPES, type SupplierEntryType } from "@/lib/supplier-ledger"

const MAX_BODY_BYTES = 24 * 1024
const MAX_AMOUNT = 2_000_000_000
const PAYMENT_METHODS = new Set(["CASH", "CARD_MACHINE", "QRIS", "TRANSFER", "OTHER"])

function parseImages(value: unknown) {
  if (!Array.isArray(value) || value.length > 6) throw new Error("Add no more than 6 supporting images.")
  return value.map((item) => {
    if (typeof item !== "string" || item.length > 1500) throw new Error("A supporting image address is invalid.")
    const url = new URL(item)
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error("A supporting image address is invalid.")
    return url.toString()
  })
}

function isValidBusinessDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const operator = await getPosOperatorFromRequest(req)
  if (!operator) return NextResponse.json({ error: "Unlock the POS with a cashier PIN before recording supplier activity.", code: "POS_PIN_LOCKED" }, { status: 423 })
  if (isRequestBodyTooLarge(req, MAX_BODY_BYTES)) return NextResponse.json({ error: "Supplier entry is too large." }, { status: 413 })

  const data = await req.json().catch(() => ({}))
  const supplierId = typeof data.supplierId === "string" ? data.supplierId : ""
  const entryType = typeof data.entryType === "string" ? data.entryType.toUpperCase() as SupplierEntryType : ""
  const amount = Number(data.amount)
  const businessDate = typeof data.businessDate === "string" ? data.businessDate : ""
  const description = typeof data.description === "string" ? cleanString(data.description, 1000) : ""
  const reference = typeof data.reference === "string" ? cleanString(data.reference, 160) : ""
  const paymentMethod = typeof data.paymentMethod === "string" ? data.paymentMethod.toUpperCase() : ""

  if (!supplierId) return NextResponse.json({ error: "Choose a supplier." }, { status: 400 })
  if (!SUPPLIER_ENTRY_TYPES.includes(entryType as SupplierEntryType)) return NextResponse.json({ error: "Choose bill received or supplier payment." }, { status: 400 })
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_AMOUNT) return NextResponse.json({ error: "Enter a whole IDR amount greater than zero." }, { status: 400 })
  if (!isValidBusinessDate(businessDate)) return NextResponse.json({ error: "Choose a valid accounting date." }, { status: 400 })
  if (entryType === "PAYMENT" && paymentMethod && !PAYMENT_METHODS.has(paymentMethod)) return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 })

  let imageUrls: string[]
  try {
    imageUrls = parseImages(data.imageUrls || [])
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Supporting images are invalid." }, { status: 400 })
  }

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: supplierId } })
      if (!supplier || !supplier.active) throw new Error("SUPPLIER_NOT_AVAILABLE")

      if (entryType === "PAYMENT") {
        const rows = await tx.supplierLedgerEntry.groupBy({
          by: ["entryType"],
          where: { supplierId, voidedAt: null },
          _sum: { amount: true },
        })
        const balance = rows.reduce((total, row) => total + (row.entryType === "BILL" ? 1 : -1) * (row._sum.amount || 0), 0)
        if (amount > balance) throw new Error("PAYMENT_EXCEEDS_BALANCE")
      }

      return tx.supplierLedgerEntry.create({
        data: {
          supplierId,
          entryType,
          amount,
          businessDate,
          description: description || null,
          imageUrls: JSON.stringify(imageUrls),
          paymentMethod: entryType === "PAYMENT" ? paymentMethod || "OTHER" : null,
          reference: reference || null,
          createdById: operator.id,
        },
        include: { supplier: { select: { id: true, name: true, outletName: true } }, createdBy: { select: { id: true, name: true, email: true } } },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    const response = NextResponse.json(entry, { status: 201 })
    setPosOperatorCookie(response, operator.id, POS_PIN_LOCK_SECONDS)
    return response
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_EXCEEDS_BALANCE") {
      return NextResponse.json({ error: "This payment is greater than the supplier balance. Check the amount or add the missing bill first." }, { status: 409 })
    }
    if (error instanceof Error && error.message === "SUPPLIER_NOT_AVAILABLE") {
      return NextResponse.json({ error: "That supplier is not available." }, { status: 404 })
    }
    console.error("Could not record supplier ledger entry", { error, supplierId, entryType, operatorId: operator.id })
    return NextResponse.json({ error: "Could not record this supplier entry. Please try again." }, { status: 500 })
  }
}
