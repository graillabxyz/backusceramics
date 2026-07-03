import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isFullAdminRole } from "@/lib/permissions"

type EventTypeCount = { type: string; _count: { type: number } }
type TopPageCount = { path: string | null; _count: { path: number } }
type TopProductCount = {
  productSlug: string | null
  productName: string | null
  productCategory: string | null
  _count: { productSlug: number }
}

export async function GET() {
  let session

  try {
    session = await auth()
  } catch (error) {
    console.error("Could not verify analytics access", error)
    return NextResponse.json(
      { error: "Could not verify admin access. Please try again shortly.", code: "AUTH_LOOKUP_FAILED" },
      { status: 503 }
    )
  }

  if (!session || !isFullAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  const analyticsWindowDays = 30
  const analyticsSince = new Date(now.getTime() - analyticsWindowDays * 24 * 60 * 60 * 1000)

  let coreStats

  try {
    coreStats = await Promise.all([
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
  } catch (error) {
    console.error("Could not load admin dashboard core metrics", error)
    return NextResponse.json(
      { error: "Could not load dashboard metrics. Database communication failed.", code: "ANALYTICS_CORE_FAILED" },
      { status: 503 }
    )
  }

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
  ] = coreStats

  let eventsByType: EventTypeCount[] = []
  let uniqueVisitors: Array<{ visitorId: string | null }> = []
  let topPages: TopPageCount[] = []
  let topProducts: TopProductCount[] = []
  let recentEvents: Array<{
    id: string
    type: string
    path: string | null
    productName: string | null
    productSlug: string | null
    workshopTitle: string | null
    source: string | null
    value: number | null
    currency: string | null
    createdAt: Date
  }> = []
  let analyticsError: string | null = null

  try {
    const analyticsResults = await Promise.all([
      prisma.analyticsEvent.groupBy({
        by: ["type"],
        where: { createdAt: { gte: analyticsSince } },
        _count: { type: true },
      }),
      prisma.analyticsEvent.findMany({
        where: {
          createdAt: { gte: analyticsSince },
          visitorId: { not: null },
        },
        distinct: ["visitorId"],
        select: { visitorId: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["path"],
        where: {
          type: "page_view",
          createdAt: { gte: analyticsSince },
          path: { not: null },
        },
        _count: { path: true },
        orderBy: { _count: { path: "desc" } },
        take: 10,
      }),
      prisma.analyticsEvent.groupBy({
        by: ["productSlug", "productName", "productCategory"],
        where: {
          type: "product_view",
          createdAt: { gte: analyticsSince },
          productSlug: { not: null },
        },
        _count: { productSlug: true },
        orderBy: { _count: { productSlug: "desc" } },
        take: 10,
      }),
      prisma.analyticsEvent.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          path: true,
          productName: true,
          productSlug: true,
          workshopTitle: true,
          source: true,
          value: true,
          currency: true,
          createdAt: true,
        },
      }),
    ])
    eventsByType = analyticsResults[0] as EventTypeCount[]
    uniqueVisitors = analyticsResults[1] as Array<{ visitorId: string | null }>
    topPages = analyticsResults[2] as TopPageCount[]
    topProducts = analyticsResults[3] as TopProductCount[]
    recentEvents = analyticsResults[4]
  } catch (error) {
    analyticsError = "Site analytics are not available yet. Run the analytics database migration to enable this section."
    console.error("Could not load site analytics metrics", error)
  }

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
  const eventCounts = eventsByType.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = item._count.type
    return acc
  }, {})
  const paymentSessionsCreated = eventCounts.payment_session_created || 0
  const paymentsCompleted = eventCounts.payment_completed || 0

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
    analyticsError,
    analyticsWindowDays,
    eventCounts,
    pageViews30d: eventCounts.page_view || 0,
    uniqueVisitors30d: uniqueVisitors.length,
    productViews30d: eventCounts.product_view || 0,
    checkoutViews30d: eventCounts.checkout_view || 0,
    checkoutIntentClicks30d: eventCounts.checkout_intent_click || 0,
    paymentIntentClicks30d: eventCounts.payment_intent_click || 0,
    paymentSessionsCreated30d: paymentSessionsCreated,
    paymentsCompleted30d: paymentsCompleted,
    checkoutAbandoned30d: eventCounts.checkout_abandoned || 0,
    paymentStartFailed30d: eventCounts.payment_start_failed || 0,
    openPaymentSessions30d: Math.max(paymentSessionsCreated - paymentsCompleted, 0),
    topPages: topPages.map((item) => ({
      path: item.path || "/",
      views: item._count.path,
    })),
    topProducts: topProducts.map((item) => ({
      slug: item.productSlug || "",
      name: item.productName || item.productSlug || "Unknown product",
      category: item.productCategory || "Product",
      views: item._count.productSlug,
    })),
    recentEvents,
  })
}
