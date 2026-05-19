import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { title, description, images } = await req.json()

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const update = await prisma.orderUpdate.create({
    data: {
      orderId: id,
      title,
      description: description || null,
      images: images ? JSON.stringify(images) : null,
    },
  })

  return NextResponse.json(update)
}
