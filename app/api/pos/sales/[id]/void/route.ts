import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { recordAnalyticsEvent } from "@/lib/analytics-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  const data = await req.json().catch(() => ({}))
  const reason = typeof data.reason === "string" ? data.reason.trim().slice(0, 500) : ""
  const restock = data.restock !== false

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const existing = await tx.posSale.findUnique({
        where: { id },
        include: { items: true },
      })

      if (!existing) {
        throw new Error("Sale not found")
      }

      if (existing.status === "VOIDED") {
        throw new Error("Sale has already been voided")
      }

      if (existing.status === "CANCELLED") {
        throw new Error("Cancelled sales do not need to be voided")
      }

      if (restock) {
        for (const item of existing.items) {
          if (!item.productId) continue
          await tx.posProduct.updateMany({
            where: { id: item.productId },
            data: {
              quantity: { increment: item.quantity },
              status: "AVAILABLE",
            },
          })
        }
      }

      return tx.posSale.update({
        where: { id },
        data: {
          status: "VOIDED",
          voidedAt: new Date(),
          voidedById: session.user.id,
          voidReason: reason || null,
        },
        include: {
          items: true,
          operator: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          voidedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })
    })

    await recordAnalyticsEvent({
      type: "pos_sale_voided",
      userId: session.user.id,
      source: "pos",
      value: sale.total,
      currency: sale.currency,
      metadata: {
        saleId: sale.id,
        restocked: restock,
        reason: reason || undefined,
      },
    }, req)

    return NextResponse.json(sale)
  } catch (error) {
    console.error("Could not void POS sale", { saleId: id, error })
    const message = error instanceof Error ? error.message : "Sale could not be voided"
    const status = message === "Sale not found" ? 404 : 409
    return NextResponse.json({ error: message }, { status })
  }
}
