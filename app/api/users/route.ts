import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      createdAt: true,
      _count: {
        select: {
          orders: true,
          classBookings: true,
          residencyApps: true,
        },
      },
    },
  })

  return NextResponse.json(users)
}
