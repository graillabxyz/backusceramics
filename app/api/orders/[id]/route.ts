import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"
import { isRequestBodyTooLarge } from "@/lib/server-security"

const orderStatuses = [
  "INQUIRY",
  "REVIEWING",
  "QUOTED",
  "ACCEPTED",
  "IN_PROGRESS",
  "GLAZING",
  "FIRING",
  "COMPLETED",
  "SHIPPED",
  "CANCELLED",
] as const
const MAX_ORDER_STATUS_BODY_BYTES = 8 * 1024

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      updates: { orderBy: { createdAt: "desc" } },
      user: { select: { name: true, email: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Regular users can only see their own orders
  if (!isFullAdminRole(session.user.role) && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(order)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isRequestBodyTooLarge(req, MAX_ORDER_STATUS_BODY_BYTES)) return NextResponse.json({ error: "Order update is too large" }, { status: 413 })
  const data = await req.json().catch(() => null)
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Order update is not valid JSON" }, { status: 400 })
  const updateData: Record<string, string> = {}

  if (data.status) {
    if (!orderStatuses.includes(data.status)) {
      return NextResponse.json({ error: "Invalid order status" }, { status: 400 })
    }
    updateData.status = data.status
  }

  const existing = await prisma.order.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  const order = await prisma.order.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json(order)
}
