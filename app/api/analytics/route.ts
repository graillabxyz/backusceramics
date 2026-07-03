import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canViewAnalytics } from "@/lib/permissions"

type EventTypeCount = { type: string; _count: { type: number } }
type TopPageCount = { path: string | null; _count: { path: number } }
type TopProductCount = {
  productSlug: string | null
  productName: string | null
  productCategory: string | null
  _count: { productSlug: number }
}
type EventLocation = {
  city: string | null
  region: string | null
  country: string | null
}

const analyticsTimeZone = "Asia/Makassar"
const countryDisplayNames = typeof Intl.DisplayNames !== "undefined"
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null

function timeZoneParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: analyticsTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

function localDayKey(date: Date) {
  const parts = timeZoneParts(date)
  return `${parts.year}-${parts.month}-${parts.day}`
}

function localHour(date: Date) {
  const hour = Number(timeZoneParts(date).hour)
  return Number.isInteger(hour) ? hour : 0
}

function viewerKey(event: {
  userId: string | null
  visitorId: string | null
  sessionId: string | null
}) {
  return event.userId || event.visitorId || event.sessionId || "anonymous"
}

function viewerName(event: {
  visitorId: string | null
  user?: { name: string | null; email: string | null } | null
}) {
  if (event.user?.name) return event.user.name
  if (event.user?.email) return event.user.email
  if (event.visitorId) return `Visitor ${event.visitorId.slice(0, 8)}`
  return "Anonymous visitor"
}

function viewerEmail(event: {
  visitorId: string | null
  sessionId: string | null
  user?: { email: string | null } | null
}) {
  if (event.user?.email) return event.user.email
  if (event.sessionId) return `Session ${event.sessionId.slice(0, 8)}`
  if (event.visitorId) return `Visitor ${event.visitorId.slice(0, 8)}`
  return null
}

function countryLabel(country: string | null) {
  if (!country) return null
  const code = country.trim().toUpperCase()
  if (!code) return null

  try {
    const name = countryDisplayNames?.of(code)
    return name && name !== code ? `${name} (${code})` : code
  } catch {
    return code
  }
}

function locationKey(event: EventLocation) {
  const parts = [event.country, event.region, event.city]
    .map((value) => value?.trim().toLowerCase() || "")
  return parts.some(Boolean) ? parts.join("|") : "unknown"
}

function locationLabel(event: EventLocation) {
  const label = [
    event.city,
    event.region,
    countryLabel(event.country) || event.country,
  ].filter(Boolean).join(", ")

  return label || "Unknown location"
}

function locationPayload(event: EventLocation) {
  return {
    key: locationKey(event),
    label: locationLabel(event),
    city: event.city,
    region: event.region,
    country: event.country,
    countryLabel: countryLabel(event.country),
  }
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

  if (!session || !canViewAnalytics(session.user.role)) {
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
    visitorId: string | null
    sessionId: string | null
    userId: string | null
    city: string | null
    region: string | null
    country: string | null
    createdAt: Date
    user: { name: string | null; email: string | null; image: string | null } | null
  }> = []
  let pageViewEvents: Array<{
    id: string
    path: string | null
    pageTitle: string | null
    visitorId: string | null
    sessionId: string | null
    userId: string | null
    city: string | null
    region: string | null
    country: string | null
    createdAt: Date
    user: { name: string | null; email: string | null; image: string | null } | null
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
          visitorId: true,
          sessionId: true,
          userId: true,
          city: true,
          region: true,
          country: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true,
              image: true,
            },
          },
        },
      }),
      prisma.analyticsEvent.findMany({
        where: {
          type: "page_view",
          createdAt: { gte: analyticsSince },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          path: true,
          pageTitle: true,
          visitorId: true,
          sessionId: true,
          userId: true,
          city: true,
          region: true,
          country: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true,
              image: true,
            },
          },
        },
      }),
    ])
    eventsByType = analyticsResults[0] as EventTypeCount[]
    uniqueVisitors = analyticsResults[1] as Array<{ visitorId: string | null }>
    topPages = analyticsResults[2] as TopPageCount[]
    topProducts = analyticsResults[3] as TopProductCount[]
    recentEvents = analyticsResults[4]
    pageViewEvents = analyticsResults[5]
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
  const locationMap = new Map<string, {
    key: string
    label: string
    city: string | null
    region: string | null
    country: string | null
    countryLabel: string | null
    views: number
    visitors: Set<string>
    signedInUsers: Set<string>
  }>()
  const countryMap = new Map<string, {
    key: string
    label: string
    country: string | null
    views: number
    visitors: Set<string>
  }>()
  const dailyLocationMap = new Map<string, {
    date: string
    totalViews: number
    locations: Map<string, { key: string; label: string; views: number }>
  }>()
  const pageLocationMap = new Map<string, {
    path: string
    views: number
    locations: Map<string, { key: string; label: string; views: number }>
  }>()
  const dailyUserMap = new Map<string, {
    date: string
    totalViews: number
    users: Map<string, {
      key: string
      name: string
      email: string | null
      image: string | null
      visitorId: string | null
      views: number
    }>
  }>()
  const dailyHourMap = new Map<string, { date: string; totalViews: number; hours: number[] }>()

  pageViewEvents.forEach((event) => {
    const date = localDayKey(event.createdAt)
    const hour = localHour(event.createdAt)
    const key = viewerKey(event)
    const location = locationPayload(event)
    const countryKey = event.country?.trim().toUpperCase() || "unknown"
    const viewerIdentifier = viewerKey(event)

    const existingLocation = locationMap.get(location.key) || {
      ...location,
      views: 0,
      visitors: new Set<string>(),
      signedInUsers: new Set<string>(),
    }
    existingLocation.views += 1
    existingLocation.visitors.add(viewerIdentifier)
    if (event.userId) existingLocation.signedInUsers.add(event.userId)
    locationMap.set(location.key, existingLocation)

    const existingCountry = countryMap.get(countryKey) || {
      key: countryKey,
      label: countryLabel(event.country) || event.country || "Unknown country",
      country: event.country,
      views: 0,
      visitors: new Set<string>(),
    }
    existingCountry.views += 1
    existingCountry.visitors.add(viewerIdentifier)
    countryMap.set(countryKey, existingCountry)

    const dayLocations = dailyLocationMap.get(date) || { date, totalViews: 0, locations: new Map() }
    const existingDayLocation = dayLocations.locations.get(location.key) || {
      key: location.key,
      label: location.label,
      views: 0,
    }
    existingDayLocation.views += 1
    dayLocations.totalViews += 1
    dayLocations.locations.set(location.key, existingDayLocation)
    dailyLocationMap.set(date, dayLocations)

    const pagePath = event.path || "/"
    const pageLocations = pageLocationMap.get(pagePath) || { path: pagePath, views: 0, locations: new Map() }
    const existingPageLocation = pageLocations.locations.get(location.key) || {
      key: location.key,
      label: location.label,
      views: 0,
    }
    existingPageLocation.views += 1
    pageLocations.views += 1
    pageLocations.locations.set(location.key, existingPageLocation)
    pageLocationMap.set(pagePath, pageLocations)

    const dayUsers = dailyUserMap.get(date) || { date, totalViews: 0, users: new Map() }
    const existingUser = dayUsers.users.get(key) || {
      key,
      name: viewerName(event),
      email: viewerEmail(event),
      image: event.user?.image || null,
      visitorId: event.visitorId,
      views: 0,
    }
    existingUser.views += 1
    dayUsers.totalViews += 1
    dayUsers.users.set(key, existingUser)
    dailyUserMap.set(date, dayUsers)

    const dayHours = dailyHourMap.get(date) || { date, totalViews: 0, hours: Array.from({ length: 24 }, () => 0) }
    dayHours.hours[hour] = (dayHours.hours[hour] || 0) + 1
    dayHours.totalViews += 1
    dailyHourMap.set(date, dayHours)
  })

  const dailyUserPageViewRankings = Array.from(dailyUserMap.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((day) => ({
      date: day.date,
      totalViews: day.totalViews,
      users: Array.from(day.users.values())
        .sort((a, b) => b.views - a.views)
        .slice(0, 10),
    }))

  const dailyHourlyPageViews = Array.from(dailyHourMap.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((day) => ({
      date: day.date,
      totalViews: day.totalViews,
      hours: day.hours.map((views, hour) => ({ hour, views })),
    }))
  const topLocations = Array.from(locationMap.values())
    .map((location) => ({
      key: location.key,
      label: location.label,
      city: location.city,
      region: location.region,
      country: location.country,
      countryLabel: location.countryLabel,
      views: location.views,
      visitors: location.visitors.size,
      signedInUsers: location.signedInUsers.size,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 20)

  const topCountries = Array.from(countryMap.values())
    .map((country) => ({
      key: country.key,
      label: country.label,
      country: country.country,
      views: country.views,
      visitors: country.visitors.size,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 20)

  const dailyLocationPageViews = Array.from(dailyLocationMap.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((day) => ({
      date: day.date,
      totalViews: day.totalViews,
      locations: Array.from(day.locations.values())
        .sort((a, b) => b.views - a.views)
        .slice(0, 6),
    }))

  const pageLocationBreakdown = Array.from(pageLocationMap.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, 12)
    .map((page) => ({
      path: page.path,
      views: page.views,
      locations: Array.from(page.locations.values())
        .sort((a, b) => b.views - a.views)
        .slice(0, 5),
    }))

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
    pageViewInstances: pageViewEvents.slice(0, 100).map((event) => ({
      id: event.id,
      path: event.path || "/",
      pageTitle: event.pageTitle,
      createdAt: event.createdAt,
      localDate: localDayKey(event.createdAt),
      localHour: localHour(event.createdAt),
      viewer: {
        id: event.userId || null,
        name: viewerName(event),
        email: viewerEmail(event),
        image: event.user?.image || null,
        visitorId: event.visitorId,
        sessionId: event.sessionId,
        signedIn: Boolean(event.userId),
      },
      location: locationPayload(event),
    })),
    dailyUserPageViewRankings,
    dailyHourlyPageViews,
    topLocations,
    topCountries,
    dailyLocationPageViews,
    pageLocationBreakdown,
    analyticsTimeZone,
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      type: event.type,
      path: event.path,
      productName: event.productName,
      productSlug: event.productSlug,
      workshopTitle: event.workshopTitle,
      source: event.source,
      value: event.value,
      currency: event.currency,
      createdAt: event.createdAt,
      viewer: {
        id: event.userId || null,
        name: viewerName(event),
        email: viewerEmail(event),
        image: event.user?.image || null,
        visitorId: event.visitorId,
        sessionId: event.sessionId,
        signedIn: Boolean(event.userId),
      },
      location: locationPayload(event),
    })),
  })
}
