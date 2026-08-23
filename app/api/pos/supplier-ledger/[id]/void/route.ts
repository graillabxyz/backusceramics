import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"
import { authorizeSupplierAccess, refreshSupplierAccess } from "@/lib/supplier-access"

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeSupplierAccess(req)
  if ("error" in access) return NextResponse.json({ error: access.error, code: access.status === 423 ? "POS_PIN_LOCKED" : undefined }, { status: access.status })
  if (isRequestBodyTooLarge(req, 8 * 1024)) return NextResponse.json({ error: "Void request is too large." }, { status: 413 })

  const { id } = await context.params
  const data = await req.json().catch(() => ({}))
  const reason = typeof data.reason === "string" ? cleanString(data.reason, 500) : ""
  if (reason.length < 3) return NextResponse.json({ error: "Add a reason for voiding this entry." }, { status: 400 })

  const updated = await prisma.supplierLedgerEntry.updateMany({
    where: { id, voidedAt: null },
    data: { voidedAt: new Date(), voidedById: access.actorId, voidReason: reason },
  })
  if (updated.count !== 1) return NextResponse.json({ error: "This entry was already voided or no longer exists." }, { status: 409 })

  const response = NextResponse.json({ ok: true })
  return refreshSupplierAccess(response, access)
}
