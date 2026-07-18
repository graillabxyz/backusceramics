import { Prisma } from "@prisma/client"
import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getProductCategoryLabel, normalizeProductCategory } from "@/lib/pos-catalog"
import { canViewAnalytics } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

type AnalyticsRange = "day" | "week" | "month" | "year" | "2y" | "5y"
type AnalyticsMetric =
  | "overview"
  | "locations"
  | "visitors"
  | "pages"
  | "sales"
  | "classes"
  | "conversion"
  | "events"
type BucketUnit = "hour" | "day" | "month"
type RangeDefinition = {
  label: string
  bucket: BucketUnit
  points: number
  sinceMs: number
}

const analyticsTimeZone = "Asia/Makassar"
const hourMs = 60 * 60 * 1000
const dayMs = 24 * hourMs
const ranges: Record<AnalyticsRange, RangeDefinition> = {
  day: { label: "Last 24 hours", bucket: "hour", points: 24, sinceMs: 24 * hourMs },
  week: { label: "Last 7 days", bucket: "day", points: 7, sinceMs: 7 * dayMs },
  month: { label: "Last 30 days", bucket: "day", points: 30, sinceMs: 30 * dayMs },
  year: { label: "Last 12 months", bucket: "month", points: 12, sinceMs: 370 * dayMs },
  "2y": { label: "Last 2 years", bucket: "month", points: 24, sinceMs: 2 * 370 * dayMs },
  "5y": { label: "Last 5 years", bucket: "month", points: 60, sinceMs: 5 * 370 * dayMs },
}
const metrics = new Set<AnalyticsMetric>([
  "overview",
  "locations",
  "visitors",
  "pages",
  "sales",
  "classes",
  "conversion",
  "events",
])
const classCategories = new Set([
  "ALL",
  "WHEEL",
  "HANDBUILDING",
  "MULTI_DAY",
  "KIDS_FAMILY",
  "PRIVATE_EVENTS",
  "OTHER",
])
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

function bucketKey(date: Date, bucket: BucketUnit) {
  const parts = timeZoneParts(date)
  if (bucket === "hour") return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:00`
  if (bucket === "month") return `${parts.year}-${parts.month}`
  return `${parts.year}-${parts.month}-${parts.day}`
}

function bucketKeys(now: Date, definition: RangeDefinition) {
  if (definition.bucket === "month") {
    const parts = timeZoneParts(now)
    const currentYear = Number(parts.year)
    const currentMonth = Number(parts.month)

    return Array.from({ length: definition.points }, (_, index) => {
      const monthsAgo = definition.points - 1 - index
      const normalized = currentYear * 12 + currentMonth - 1 - monthsAgo
      const year = Math.floor(normalized / 12)
      const month = (normalized % 12) + 1
      return `${year}-${String(month).padStart(2, "0")}`
    })
  }

  const stepMs = definition.bucket === "hour" ? hourMs : dayMs
  return Array.from({ length: definition.points }, (_, index) => {
    const stepsAgo = definition.points - 1 - index
    return bucketKey(new Date(now.getTime() - stepsAgo * stepMs), definition.bucket)
  })
}

function classCategory(workshopId: string) {
  if (workshopId === "beginner-wheel") return "WHEEL"
  if (workshopId === "handbuilding") return "HANDBUILDING"
  if (workshopId === "3-day-workshop" || workshopId === "6-day-workshop") return "MULTI_DAY"
  if (workshopId === "kids-workshop" || workshopId === "birthday-event") return "KIDS_FAMILY"
  if (workshopId === "private-atelier") return "PRIVATE_EVENTS"
  return "OTHER"
}

function countryLabel(country: string) {
  const code = country.trim().toUpperCase()
  if (!code || code === "UNKNOWN") return "Unknown"

  try {
    const name = countryDisplayNames?.of(code)
    return name && name !== code ? `${name} (${code})` : code
  } catch {
    return code
  }
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0)
}

function jsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": status === 200
        ? "private, max-age=60, stale-while-revalidate=120"
        : "no-store",
    },
  })
}

async function loadTrafficBuckets(
  since: Date,
  definition: RangeDefinition
) {
  const format = definition.bucket === "hour"
    ? "YYYY-MM-DD HH24:00"
    : definition.bucket === "month"
      ? "YYYY-MM"
      : "YYYY-MM-DD"

  return prisma.$queryRaw<Array<{
    bucket: string
    views: number
    visitors: number
  }>>(Prisma.sql`
    SELECT
      to_char(
        date_trunc(${definition.bucket}, "createdAt" AT TIME ZONE ${analyticsTimeZone}),
        ${format}
      ) AS "bucket",
      COUNT(*)::int AS "views",
      COUNT(
        DISTINCT COALESCE("userId", "visitorId", "sessionId", 'anonymous')
      )::int AS "visitors"
    FROM "AnalyticsEvent"
    WHERE "type" = 'page_view'
      AND "createdAt" >= ${since}
    GROUP BY 1
    ORDER BY 1
  `)
}

async function loadSaleBuckets(
  since: Date,
  definition: RangeDefinition,
  category: string
) {
  const sales = await prisma.posSale.findMany({
    where: {
      status: "PAID",
      createdAt: { gte: since },
    },
    select: {
      id: true,
      createdAt: true,
      total: true,
      taxTotal: true,
      discountTotal: true,
      items: {
        select: {
          categorySnapshot: true,
          lineTotal: true,
          taxAmount: true,
          discountAmount: true,
        },
      },
    },
  })
  const rows = new Map<string, {
    bucket: string
    sales: number
    revenue: number
    tax: number
    discount: number
  }>()

  sales.forEach((sale) => {
    const key = bucketKey(sale.createdAt, definition.bucket)
    const row = rows.get(key) || {
      bucket: key,
      sales: 0,
      revenue: 0,
      tax: 0,
      discount: 0,
    }

    if (category === "ALL") {
      row.sales += 1
      row.revenue += sale.total
      row.tax += sale.taxTotal
      row.discount += sale.discountTotal
      rows.set(key, row)
      return
    }

    const matchingItems = sale.items.filter(
      (item) => normalizeProductCategory(item.categorySnapshot) === category
    )
    if (matchingItems.length === 0) return

    row.sales += 1
    row.revenue += sum(matchingItems.map((item) => item.lineTotal))
    row.tax += sum(matchingItems.map((item) => item.taxAmount))
    row.discount += sum(matchingItems.map((item) => item.discountAmount))
    rows.set(key, row)
  })

  return rows
}

async function loadClassBuckets(
  since: Date,
  definition: RangeDefinition,
  category: string
) {
  const bookings = await prisma.classBooking.findMany({
    where: {
      createdAt: { gte: since },
      status: { in: ["CONFIRMED", "COMPLETED", "PENDING"] },
    },
    select: {
      workshopId: true,
      status: true,
      participants: true,
      createdAt: true,
    },
  })
  const rows = new Map<string, {
    bucket: string
    bookings: number
    seats: number
    pendingBookings: number
    pendingSeats: number
  }>()

  bookings.forEach((booking) => {
    if (category !== "ALL" && classCategory(booking.workshopId) !== category) return

    const key = bucketKey(booking.createdAt, definition.bucket)
    const row = rows.get(key) || {
      bucket: key,
      bookings: 0,
      seats: 0,
      pendingBookings: 0,
      pendingSeats: 0,
    }

    if (booking.status === "PENDING") {
      row.pendingBookings += 1
      row.pendingSeats += booking.participants
    } else {
      row.bookings += 1
      row.seats += booking.participants
    }
    rows.set(key, row)
  })

  return rows
}

export async function GET(request: NextRequest) {
  let session

  try {
    session = await auth()
  } catch (error) {
    console.error("Could not verify analytics chart access", error)
    return jsonResponse(
      { error: "Could not verify analytics access.", code: "AUTH_LOOKUP_FAILED" },
      503
    )
  }

  if (!session || !canViewAnalytics(session.user.role)) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  const rangeParam = request.nextUrl.searchParams.get("range") || "month"
  const metricParam = request.nextUrl.searchParams.get("metric") || "overview"
  const categoryParam = (request.nextUrl.searchParams.get("category") || "ALL").toUpperCase()

  if (!(rangeParam in ranges) || !metrics.has(metricParam as AnalyticsMetric)) {
    return jsonResponse({ error: "Invalid analytics chart request." }, 400)
  }

  const range = rangeParam as AnalyticsRange
  const metric = metricParam as AnalyticsMetric
  const definition = ranges[range]
  const now = new Date()
  const since = new Date(now.getTime() - definition.sinceMs)
  const keys = bucketKeys(now, definition)

  try {
    if (metric === "locations") {
      const rows = await prisma.$queryRaw<Array<{
        country: string
        views: number
        visitors: number
      }>>(Prisma.sql`
        SELECT
          COALESCE(NULLIF("country", ''), 'Unknown') AS "country",
          COUNT(*)::int AS "views",
          COUNT(
            DISTINCT COALESCE("userId", "visitorId", "sessionId", 'anonymous')
          )::int AS "visitors"
        FROM "AnalyticsEvent"
        WHERE "type" = 'page_view'
          AND "createdAt" >= ${since}
        GROUP BY 1
        ORDER BY "views" DESC
        LIMIT 10
      `)

      return jsonResponse({
        range,
        rangeLabel: definition.label,
        bucket: definition.bucket,
        points: rows.map((row) => ({
          label: countryLabel(row.country),
          views: Number(row.views),
          visitors: Number(row.visitors),
        })),
      })
    }

    if (metric === "pages") {
      const rows = await prisma.analyticsEvent.groupBy({
        by: ["path"],
        where: {
          type: "page_view",
          createdAt: { gte: since },
          path: { not: null },
        },
        _count: { path: true },
        orderBy: { _count: { path: "desc" } },
        take: 10,
      })

      return jsonResponse({
        range,
        rangeLabel: definition.label,
        bucket: definition.bucket,
        points: rows.map((row) => ({
          label: row.path || "/",
          views: row._count.path,
        })),
      })
    }

    if (metric === "events" || metric === "conversion") {
      const rows = await prisma.analyticsEvent.groupBy({
        by: ["type"],
        where: { createdAt: { gte: since } },
        _count: { type: true },
      })
      const counts = new Map(rows.map((row) => [row.type, row._count.type]))
      const points = metric === "conversion"
        ? [
            { label: "Checkout views", value: counts.get("checkout_view") || 0 },
            { label: "Clicked pay", value: counts.get("payment_intent_click") || 0 },
            { label: "Payment sessions", value: counts.get("payment_session_created") || 0 },
            { label: "Completed", value: counts.get("payment_completed") || 0 },
          ]
        : rows
            .sort((a, b) => b._count.type - a._count.type)
            .slice(0, 10)
            .map((row) => ({ label: row.type, count: row._count.type }))

      return jsonResponse({
        range,
        rangeLabel: definition.label,
        bucket: definition.bucket,
        points,
      })
    }

    if (metric === "sales") {
      const normalizedCategory = categoryParam === "ALL"
        ? "ALL"
        : normalizeProductCategory(categoryParam)
      const rows = await loadSaleBuckets(since, definition, normalizedCategory)

      return jsonResponse({
        range,
        rangeLabel: definition.label,
        bucket: definition.bucket,
        category: normalizedCategory,
        categoryLabel: normalizedCategory === "ALL"
          ? "All sales"
          : getProductCategoryLabel(normalizedCategory),
        points: keys.map((key) => rows.get(key) || {
          bucket: key,
          sales: 0,
          revenue: 0,
          tax: 0,
          discount: 0,
        }),
      })
    }

    if (metric === "classes") {
      const category = classCategories.has(categoryParam) ? categoryParam : "ALL"
      const rows = await loadClassBuckets(since, definition, category)

      return jsonResponse({
        range,
        rangeLabel: definition.label,
        bucket: definition.bucket,
        category,
        points: keys.map((key) => rows.get(key) || {
          bucket: key,
          bookings: 0,
          seats: 0,
          pendingBookings: 0,
          pendingSeats: 0,
        }),
      })
    }

    const trafficRows = await loadTrafficBuckets(since, definition)
    const traffic = new Map(trafficRows.map((row) => [row.bucket, row]))

    if (metric === "visitors") {
      return jsonResponse({
        range,
        rangeLabel: definition.label,
        bucket: definition.bucket,
        points: keys.map((key) => ({
          bucket: key,
          views: Number(traffic.get(key)?.views || 0),
          visitors: Number(traffic.get(key)?.visitors || 0),
        })),
      })
    }

    const saleRows = await loadSaleBuckets(since, definition, "ALL")
    const classRows = await loadClassBuckets(since, definition, "ALL")

    return jsonResponse({
      range,
      rangeLabel: definition.label,
      bucket: definition.bucket,
      points: keys.map((key) => ({
        bucket: key,
        pageViews: Number(traffic.get(key)?.views || 0),
        sales: saleRows.get(key)?.sales || 0,
        bookings: classRows.get(key)?.bookings || 0,
      })),
    })
  } catch (error) {
    console.error("Could not load analytics chart", {
      metric,
      range,
      category: categoryParam,
      error,
    })
    return jsonResponse(
      { error: "Could not load this chart right now.", code: "ANALYTICS_CHART_FAILED" },
      503
    )
  }
}
