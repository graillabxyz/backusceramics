import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"
import { cleanString, isRequestBodyTooLarge } from "@/lib/server-security"

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

  const { title, description, images } = await req.json()
  const updateTitle = cleanString(title, 160)
  const updateDescription = cleanString(description, 4000)
  const imageUrls = Array.isArray(images)
    ? images.map((image) => cleanString(image, 500)).filter(Boolean).slice(0, 20)
    : []

  if (!updateTitle) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const update = await prisma.orderUpdate.create({
    data: {
      orderId: id,
      title: updateTitle,
      description: updateDescription || null,
      images: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
    },
  })

  return NextResponse.json(update)
}
