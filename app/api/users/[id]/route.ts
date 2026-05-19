import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { role } = await req.json()
  if (!["USER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
  })

  return NextResponse.json(user)
}
