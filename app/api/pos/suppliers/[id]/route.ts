import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"
import { authorizeSupplierAccess } from "@/lib/supplier-access"
import { normalizeSupplierName } from "@/lib/supplier-ledger"

const MAX_BODY_BYTES = 8 * 1024

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeSupplierAccess(req)
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!access.canEditSuppliers) return NextResponse.json({ error: "Only managers and administrators can edit supplier accounts." }, { status: 403 })
  if (isRequestBodyTooLarge(req, MAX_BODY_BYTES)) return NextResponse.json({ error: "Supplier request is too large." }, { status: 413 })

  const { id } = await context.params
  const data = await req.json().catch(() => ({}))
  const name = typeof data.name === "string" ? cleanString(data.name, 120) : ""
  const outletName = typeof data.outletName === "string" ? cleanString(data.outletName, 120) : ""
  const notes = typeof data.notes === "string" ? cleanString(data.notes, 1000) : ""
  if (name.length < 2) return NextResponse.json({ error: "Enter the supplier name." }, { status: 400 })

  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        normalizedName: normalizeSupplierName(name),
        outletName: outletName || null,
        normalizedOutletName: normalizeSupplierName(outletName),
        notes: notes || null,
      },
    })
    return NextResponse.json(supplier)
  } catch (error) {
    console.error("Could not update supplier account", { error, supplierId: id, actorId: access.actorId })
    return NextResponse.json({ error: "That supplier outlet already exists or could not be updated." }, { status: 409 })
  }
}
