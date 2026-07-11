import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canUsePos } from "@/lib/permissions"
import { recordAnalyticsEvent } from "@/lib/analytics-server"
import { getPosOperatorFromRequest } from "@/lib/pos-operator-session"
import { isRequestBodyTooLarge } from "@/lib/server-security"

interface RouteContext {
  params: Promise<{ id: string }>
}

const MAX_VOID_BODY_BYTES = 8 * 1024
class PosVoidValidationError extends Error {}

export async function POST(req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session || !canUsePos(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const posOperator = await getPosOperatorFromRequest(req)
  if (!posOperator) {
    return NextResponse.json({ error: "Unlock the POS with a cashier PIN before voiding a sale.", code: "POS_PIN_LOCKED" }, { status: 423 })
  }

  if (isRequestBodyTooLarge(req, MAX_VOID_BODY_BYTES)) {
    return NextResponse.json({ error: "Void request is too large" }, { status: 413 })
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
        throw new PosVoidValidationError("Sale not found")
      }

      if (existing.status === "VOIDED") {
        throw new PosVoidValidationError("Sale has already been voided")
      }

      if (existing.status === "CANCELLED") {
        throw new PosVoidValidationError("Cancelled sales do not need to be voided")
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
          voidedById: posOperator.id,
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
      userId: posOperator.id,
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
    const message = error instanceof PosVoidValidationError ? error.message : "Sale could not be voided. Please try again."
    const status = error instanceof PosVoidValidationError
      ? message === "Sale not found" ? 404 : 409
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
