import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"
import type { OrderAttachment } from "@/lib/order-attachments"

const MAX_ORDER_UPDATE_BODY_BYTES = 64 * 1024

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isRequestBodyTooLarge(req, MAX_ORDER_UPDATE_BODY_BYTES)) {
    return NextResponse.json({ error: "Order update is too large" }, { status: 413 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Order update is not valid JSON" }, { status: 400 })
  const { title, description, images, attachments } = body
  const updateTitle = cleanString(title, 160)
  const updateDescription = cleanString(description, 4000)
  const imageUrls = Array.isArray(images)
    ? images.map((image) => cleanString(image, 500)).filter(Boolean).slice(0, 20)
    : []
  const orderAttachments: OrderAttachment[] = Array.isArray(attachments)
    ? attachments.flatMap((attachment) => {
        if (!attachment || typeof attachment !== "object") return []
        const name = cleanString(attachment.name, 160)
        const storagePath = cleanString(attachment.path, 500)
        const size = Number(attachment.size)
        if (
          !name
          || !storagePath.startsWith(`orders/${id}/`)
          || !storagePath.endsWith(".pdf")
          || !Number.isFinite(size)
          || size <= 0
          || size > 12 * 1024 * 1024
          || attachment.mimeType !== "application/pdf"
        ) return []
        return [{ name, path: storagePath, size, mimeType: "application/pdf" as const }]
      }).slice(0, 10)
    : []

  if (!updateTitle) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const order = await prisma.order.findUnique({ where: { id }, select: { id: true } })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  const update = await prisma.orderUpdate.create({
    data: {
      orderId: id,
      title: updateTitle,
      description: updateDescription || null,
      images: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
      attachments: orderAttachments.length > 0 ? JSON.stringify(orderAttachments) : null,
    },
  })

  return NextResponse.json(update)
}
