import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

  const [
    totalOrders,
    totalBookings,
    totalApplications,
    totalUsers,
    orders,
    bookings,
    applications,
    ordersThisMonth,
    ordersLastMonth,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.classBooking.count(),
    prisma.residencyApplication.count(),
    prisma.user.count(),
    prisma.order.findMany({ select: { status: true } }),
    prisma.classBooking.findMany({ select: { status: true } }),
    prisma.residencyApplication.findMany({ select: { status: true } }),
    prisma.order.count({ where: { createdAt: { gte: thisMonthStart } } }),
    prisma.order.count({
      where: {
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
    }),
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { id: true, contactName: true, status: true, createdAt: true },
    }),
  ])

  // Count by status
  const ordersByStatus: Record<string, number> = {}
  orders.forEach((o) => {
    ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1
  })

  const bookingsByStatus: Record<string, number> = {}
  bookings.forEach((b) => {
    bookingsByStatus[b.status] = (bookingsByStatus[b.status] || 0) + 1
  })

  const applicationsByStatus: Record<string, number> = {}
  applications.forEach((a) => {
    applicationsByStatus[a.status] = (applicationsByStatus[a.status] || 0) + 1
  })

  return NextResponse.json({
    totalOrders,
    ordersByStatus,
    totalBookings,
    bookingsByStatus,
    totalApplications,
    applicationsByStatus,
    totalUsers,
    recentOrders,
    ordersThisMonth,
    ordersLastMonth,
  })
}
