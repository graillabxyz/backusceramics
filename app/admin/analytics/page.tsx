"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  CreditCard,
  Eye,
  Globe2,
  GraduationCap,
  Loader2,
  MapPin,
  MousePointerClick,
  ShoppingBag,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react"

type AnalyticsLocation = {
  key: string
  label: string
  city: string | null
  region: string | null
  country: string | null
  countryLabel: string | null
}

type AnalyticsViewer = {
  id: string | null
  name: string
  email: string | null
  image: string | null
  visitorId: string | null
  sessionId: string | null
  signedIn: boolean
}

type AnalyticsRange = "day" | "week" | "month" | "year" | "2y" | "5y"
type AnalyticsChartMetric =
  | "overview"
  | "locations"
  | "visitors"
  | "pages"
  | "sales"
  | "classes"
  | "conversion"
  | "events"
type AnalyticsChartPoint = {
  bucket?: string
  label?: string
  [key: string]: string | number | undefined
}

interface AnalyticsData {
  totalOrders: number
  ordersByStatus: Record<string, number>
  totalBookings: number
  bookingsByStatus: Record<string, number>
  totalApplications: number
  applicationsByStatus: Record<string, number>
  totalUsers: number
  recentOrders: Array<{ id: string; contactName: string; status: string; createdAt: string }>
  ordersThisMonth: number
  ordersLastMonth: number
  salesError?: string | null
  analyticsWindowDays: number
  salesCurrency: string
  paidSales30d: number
  pendingSales30d: number
  voidedSales30d: number
  salesRevenue30d: number
  salesSubtotal30d: number
  salesDiscount30d: number
  salesTax30d: number
  salesRevenueToday: number
  paidSalesToday: number
  averageSaleValue30d: number
  pendingSalesTotal30d: number
  voidedSalesTotal30d: number
  salesByPaymentMethod: Array<{ method: string; sales: number; revenue: number }>
  salesByCategory: Array<{
    category: string
    label: string
    quantity: number
    gross: number
    discount: number
    tax: number
    revenue: number
  }>
  dailySales: Array<{ date: string; sales: number; revenue: number; tax: number; discount: number }>
  salesCategorySeries: Array<{
    category: string
    label: string
    sales: number
    revenue: number
    data: Array<{ date: string; sales: number; revenue: number; tax: number; discount: number }>
  }>
  confirmedClassBookings30d: number
  confirmedClassSeats30d: number
  pendingClassBookings30d: number
  pendingClassSeats30d: number
  dailyClassBookings: Array<{
    date: string
    bookings: number
    seats: number
    pendingBookings: number
    pendingSeats: number
  }>
  classCategorySeries: Array<{
    category: string
    label: string
    bookings: number
    seats: number
    pendingBookings: number
    data: Array<{
      date: string
      bookings: number
      seats: number
      pendingBookings: number
      pendingSeats: number
    }>
  }>
  recentSales: Array<{
    id: string
    status: string
    paymentMethod: string
    total: number
    subtotal: number
    discountTotal: number
    taxTotal: number
    currency: string
    itemCount: number
    createdAt: string
    voidedAt: string | null
    operatorName: string
    receiptEmail: string | null
  }>
  eventCounts: Record<string, number>
  pageViews30d: number
  uniqueVisitors30d: number
  productViews30d: number
  checkoutViews30d: number
  checkoutIntentClicks30d: number
  paymentIntentClicks30d: number
  paymentSessionsCreated30d: number
  paymentsCompleted30d: number
  checkoutAbandoned30d: number
  paymentStartFailed30d: number
  openPaymentSessions30d: number
  analyticsTimeZone: string
  topPages: Array<{ path: string; views: number }>
  topProducts: Array<{ slug: string; name: string; category: string; views: number }>
  pageViewInstances: Array<{
    id: string
    path: string
    pageTitle: string | null
    createdAt: string
    localDate: string
    localHour: number
    viewer: AnalyticsViewer
    location: AnalyticsLocation
  }>
  dailyUserPageViewRankings: Array<{
    date: string
    totalViews: number
    visitorCount: number
    users: Array<{
      key: string
      name: string
      email: string | null
      image: string | null
      visitorId: string | null
      views: number
    }>
  }>
  dailyHourlyPageViews: Array<{
    date: string
    totalViews: number
    hours: Array<{ hour: number; views: number }>
  }>
  topLocations: Array<AnalyticsLocation & {
    views: number
    visitors: number
    signedInUsers: number
  }>
  topCountries: Array<{
    key: string
    label: string
    country: string | null
    views: number
    visitors: number
  }>
  dailyLocationPageViews: Array<{
    date: string
    totalViews: number
    locations: Array<{ key: string; label: string; views: number }>
  }>
  pageLocationBreakdown: Array<{
    path: string
    views: number
    locations: Array<{ key: string; label: string; views: number }>
  }>
  recentEvents: Array<{
    id: string
    type: string
    path: string | null
    productName: string | null
    productSlug: string | null
    workshopTitle: string | null
    source: string | null
    value: number | null
    currency: string
    createdAt: string
    viewer: AnalyticsViewer
    location: AnalyticsLocation
  }>
}

function rate(part: number, whole: number) {
  if (!whole) return "0%"
  return `${Math.round((part / whole) * 100)}%`
}

function formatEventType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`
}

function formatDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  if (!year || !month || !day) return dateKey
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function formatChartBucket(value: string, range: AnalyticsRange) {
  if (range === "day") {
    const [date, time] = value.split(" ")
    const formattedDate = date ? formatDateKey(date) : value
    return `${formattedDate} ${time || ""}`.trim()
  }

  if (range === "year" || range === "2y" || range === "5y") {
    const [year, month] = value.split("-").map(Number)
    if (!year || !month) return value
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    })
  }

  return formatDateKey(value)
}

function formatChartLabel(value: string, maxLength = 24) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

function formatCurrency(value: number, currency = "IDR") {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatCompactCurrency(value: number, currency = "IDR") {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0)
}

const salesChartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
  sales: {
    label: "Transactions",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

const classChartConfig = {
  seats: {
    label: "Confirmed seats",
    color: "var(--chart-1)",
  },
  bookings: {
    label: "Confirmed bookings",
    color: "var(--chart-2)",
  },
  pendingBookings: {
    label: "Pending bookings",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig

const overviewChartConfig = {
  pageViews: {
    label: "Page views",
    color: "var(--chart-1)",
  },
  sales: {
    label: "Paid sales",
    color: "var(--chart-2)",
  },
  bookings: {
    label: "Class bookings",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

const visitorChartConfig = {
  views: {
    label: "Page views",
    color: "var(--chart-1)",
  },
  visitors: {
    label: "Distinct visitors",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

const locationChartConfig = {
  views: {
    label: "Page views",
    color: "var(--chart-1)",
  },
  visitors: {
    label: "Visitors",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

const pageChartConfig = {
  views: {
    label: "Page views",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

const conversionChartConfig = {
  value: {
    label: "People / sessions",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

const eventChartConfig = {
  count: {
    label: "Events",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

function formatPaymentMethod(method: string) {
  return method.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function SectionIntro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-heading text-xl font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

function PrimaryChart({
  title,
  description,
  controls,
  loading = false,
  error,
  children,
}: {
  title: string
  description: ReactNode
  controls?: ReactNode
  loading?: boolean
  error?: string | null
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden" aria-busy={loading}>
      <CardHeader className="gap-4 border-b border-border/70 pb-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {controls}
      </CardHeader>
      <CardContent className="relative pt-5">
        {loading && (
          <div className="absolute right-5 top-3 z-10 flex items-center gap-2 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Updating
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  )
}

const analyticsRangeOptions: Array<{ value: AnalyticsRange; label: string; description: string }> = [
  { value: "day", label: "Day", description: "Last 24 hours, hourly" },
  { value: "week", label: "Week", description: "Last 7 days, daily" },
  { value: "month", label: "Month", description: "Last 30 days, daily" },
  { value: "year", label: "1Y", description: "Last 12 months, monthly" },
  { value: "2y", label: "2Y", description: "Last 2 years, monthly" },
  { value: "5y", label: "5Y", description: "Last 5 years, monthly" },
]

function analyticsRangeDescription(range: AnalyticsRange) {
  return analyticsRangeOptions.find((option) => option.value === range)?.description || "Selected range"
}

function ChartRangeControls({
  value,
  onChange,
}: {
  value: AnalyticsRange
  onChange: (range: AnalyticsRange) => void
}) {
  return (
    <div className="flex flex-wrap gap-1" aria-label="Chart time range">
      {analyticsRangeOptions.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "default" : "outline"}
          className="h-8 px-2.5 text-xs"
          aria-label={option.description}
          title={option.description}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function useAnalyticsChart(
  metric: AnalyticsChartMetric,
  defaultPoints: AnalyticsChartPoint[],
  category = "ALL"
) {
  const [range, setRange] = useState<AnalyticsRange>("month")
  const [points, setPoints] = useState<AnalyticsChartPoint[]>(defaultPoints)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (range === "month") {
      setPoints(defaultPoints)
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const params = new URLSearchParams({ metric, range, category })

    setLoading(true)
    setError(null)
    fetch(`/api/analytics/timeseries?${params.toString()}`, {
      signal: controller.signal,
      credentials: "same-origin",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || "Could not load this chart.")
        }
        setPoints(Array.isArray(payload?.points) ? payload.points : [])
      })
      .catch((chartError) => {
        if (chartError instanceof DOMException && chartError.name === "AbortError") return
        console.error("Failed to load analytics chart", { metric, range, category, chartError })
        setPoints([])
        setError(chartError instanceof Error ? chartError.message : "Could not load this chart.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [category, defaultPoints, metric, range])

  return { range, setRange, points, loading, error }
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: ReactNode
  description: ReactNode
  icon?: LucideIcon
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="truncate text-2xl font-bold text-foreground">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function ViewerAvatar({ viewer, size = "md" }: { viewer: AnalyticsViewer; size?: "sm" | "md" }) {
  const dimension = size === "sm" ? "h-8 w-8" : "h-10 w-10"
  const textSize = size === "sm" ? "text-xs" : "text-sm"

  if (viewer.image) {
    return <img src={viewer.image} alt="" className={`${dimension} shrink-0 rounded-full object-cover`} />
  }

  return (
    <div className={`${dimension} flex shrink-0 items-center justify-center rounded-full bg-muted`}>
      <span className={`${textSize} font-semibold text-muted-foreground`}>
        {viewer.name[0]?.toUpperCase() || "?"}
      </span>
    </div>
  )
}

function PageViewRow({ view }: { view: AnalyticsData["pageViewInstances"][number] }) {
  return (
    <div className="flex gap-3 rounded-md border border-border p-3">
      <ViewerAvatar viewer={view.viewer} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{view.viewer.name}</p>
          <span className="text-xs text-muted-foreground">{new Date(view.createdAt).toLocaleString()}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {view.viewer.email || (view.viewer.signedIn ? "Signed-in user" : "Anonymous visitor")}
        </p>
        <p className="mt-2 truncate text-sm text-foreground">{view.pageTitle || view.path}</p>
        <p className="truncate text-xs text-muted-foreground">{view.path}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          <MapPin className="mr-1 inline h-3 w-3" />
          {view.location.label}
        </p>
      </div>
    </div>
  )
}

function EventRow({ event }: { event: AnalyticsData["recentEvents"][number] }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <ViewerAvatar viewer={event.viewer} size="sm" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-medium text-foreground">{formatEventType(event.type)}</p>
            <Badge variant={event.viewer.signedIn ? "default" : "secondary"} className="text-[10px]">
              {event.viewer.signedIn ? "Signed in" : "Visitor"}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {event.productName || event.workshopTitle || event.path || event.source || "Site event"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {event.viewer.signedIn
              ? `${event.viewer.name}${event.viewer.email ? ` · ${event.viewer.email}` : ""}`
              : event.viewer.email || "Anonymous visitor"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{event.location.label}</p>
        </div>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
    </div>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedLocationKey, setSelectedLocationKey] = useState("ALL")
  const [selectedSalesCategory, setSelectedSalesCategory] = useState("ALL")
  const [selectedClassCategory, setSelectedClassCategory] = useState("ALL")

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const defaultOverviewPoints = useMemo<AnalyticsChartPoint[]>(() => {
    if (!data) return []
    const trafficByDate = new Map(
      data.dailyHourlyPageViews.map((day) => [day.date, day.totalViews])
    )
    const classesByDate = new Map(
      data.dailyClassBookings.map((day) => [day.date, day.bookings])
    )
    return data.dailySales.map((day) => ({
      bucket: day.date,
      pageViews: trafficByDate.get(day.date) || 0,
      sales: day.sales,
      bookings: classesByDate.get(day.date) || 0,
    }))
  }, [data])
  const defaultLocationPoints = useMemo<AnalyticsChartPoint[]>(() => (
    (data?.topCountries || []).slice(0, 10).map((country) => ({
      label: country.label,
      views: country.views,
      visitors: country.visitors,
    }))
  ), [data])
  const defaultVisitorPoints = useMemo<AnalyticsChartPoint[]>(() => {
    if (!data) return []
    const trafficByDate = new Map(
      data.dailyHourlyPageViews.map((day) => [day.date, day.totalViews])
    )
    const visitorsByDate = new Map(
      data.dailyUserPageViewRankings.map((day) => [day.date, day.visitorCount])
    )
    return data.dailySales.map((day) => ({
      bucket: day.date,
      views: trafficByDate.get(day.date) || 0,
      visitors: visitorsByDate.get(day.date) || 0,
    }))
  }, [data])
  const defaultPagePoints = useMemo<AnalyticsChartPoint[]>(() => (
    (data?.topPages || []).slice(0, 10).map((page) => ({
      label: page.path,
      views: page.views,
    }))
  ), [data])
  const defaultSalesPoints = useMemo<AnalyticsChartPoint[]>(() => {
    const series = data?.salesCategorySeries.find(
      (item) => item.category === selectedSalesCategory
    ) || data?.salesCategorySeries[0]
    return (series?.data || []).map((point) => ({ ...point, bucket: point.date }))
  }, [data, selectedSalesCategory])
  const defaultClassPoints = useMemo<AnalyticsChartPoint[]>(() => {
    const series = data?.classCategorySeries.find(
      (item) => item.category === selectedClassCategory
    ) || data?.classCategorySeries[0]
    return (series?.data || []).map((point) => ({ ...point, bucket: point.date }))
  }, [data, selectedClassCategory])
  const defaultConversionPoints = useMemo<AnalyticsChartPoint[]>(() => {
    if (!data) return []
    return [
      { label: "Checkout views", value: data.checkoutViews30d },
      { label: "Clicked pay", value: data.paymentIntentClicks30d },
      { label: "Payment sessions", value: data.paymentSessionsCreated30d },
      { label: "Completed", value: data.paymentsCompleted30d },
    ]
  }, [data])
  const defaultEventPoints = useMemo<AnalyticsChartPoint[]>(() => (
    Object.entries(data?.eventCounts || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ label: type, count }))
  ), [data])

  const overviewChart = useAnalyticsChart("overview", defaultOverviewPoints)
  const locationChart = useAnalyticsChart("locations", defaultLocationPoints)
  const visitorChart = useAnalyticsChart("visitors", defaultVisitorPoints)
  const pageChart = useAnalyticsChart("pages", defaultPagePoints)
  const salesChart = useAnalyticsChart("sales", defaultSalesPoints, selectedSalesCategory)
  const classChart = useAnalyticsChart("classes", defaultClassPoints, selectedClassCategory)
  const conversionChart = useAnalyticsChart("conversion", defaultConversionPoints)
  const eventChart = useAnalyticsChart("events", defaultEventPoints)

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/analytics")
      if (res.ok) setData(await res.json())
    } catch (err) {
      console.error("Failed to fetch analytics:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return <p className="text-muted-foreground">Failed to load analytics.</p>
  }

  const growthPercent = data.ordersLastMonth > 0
    ? Math.round(((data.ordersThisMonth - data.ordersLastMonth) / data.ordersLastMonth) * 100)
    : data.ordersThisMonth > 0 ? 100 : 0
  const paymentCompletionRate = rate(data.paymentsCompleted30d, data.paymentSessionsCreated30d)
  const checkoutClickRate = rate(data.paymentIntentClicks30d, data.checkoutViews30d)
  const maxHourlyViews = Math.max(
    1,
    ...data.dailyHourlyPageViews.flatMap((day) => day.hours.map((hour) => hour.views))
  )
  const topLocations = data.topLocations || []
  const topCountries = data.topCountries || []
  const selectedLocation = selectedLocationKey === "ALL"
    ? null
    : topLocations.find((location) => location.key === selectedLocationKey) || null
  const filteredPageViews = selectedLocation
    ? data.pageViewInstances.filter((view) => view.location.key === selectedLocation.key)
    : data.pageViewInstances
  const filteredRecentEvents = selectedLocation
    ? data.recentEvents.filter((event) => event.location.key === selectedLocation.key)
    : data.recentEvents
  const knownLocationViews = topLocations
    .filter((location) => location.key !== "unknown")
    .reduce((total, location) => total + location.views, 0)
  const unknownLocationViews = topLocations
    .filter((location) => location.key === "unknown")
    .reduce((total, location) => total + location.views, 0)
  const salesVoidRate = rate(data.voidedSales30d, data.paidSales30d + data.voidedSales30d)
  const selectedSalesSeries = data.salesCategorySeries.find(
    (series) => series.category === selectedSalesCategory
  ) || data.salesCategorySeries[0]
  const selectedClassSeries = data.classCategorySeries.find(
    (series) => series.category === selectedClassCategory
  ) || data.classCategorySeries[0]

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-muted-foreground">
            Customer traffic, visitor geography, checkout intent, and studio activity
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Detail window: {data.analyticsWindowDays} days</Badge>
          <Badge variant="outline">Charts: independent ranges</Badge>
          <Badge variant="outline">{data.analyticsTimeZone}</Badge>
          <Badge variant={selectedLocation ? "default" : "secondary"}>
            {selectedLocation ? `Focused: ${selectedLocation.label}` : "All locations"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted p-1 md:grid-cols-4 xl:grid-cols-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="visitors">Visitors</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="conversion">Conversion</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SectionIntro title="Executive View">
            Fast read on site traffic, sales intent, and operational volume.
          </SectionIntro>

          <PrimaryChart
            title="Business Activity"
            description={`${analyticsRangeDescription(overviewChart.range)}. Compare traffic, paid sales, and confirmed class bookings.`}
            controls={<ChartRangeControls value={overviewChart.range} onChange={overviewChart.setRange} />}
            loading={overviewChart.loading}
            error={overviewChart.error}
          >
            {overviewChart.points.length === 0 ? (
              <EmptyState>No activity recorded in this range</EmptyState>
            ) : (
              <ChartContainer config={overviewChartConfig} className="h-[320px] w-full">
                <LineChart
                  accessibilityLayer
                  data={overviewChart.points}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
                    tickFormatter={(value) => formatChartBucket(String(value), overviewChart.range)}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label) => formatChartBucket(String(label), overviewChart.range)}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    type="monotone"
                    dataKey="pageViews"
                    stroke="var(--color-pageViews)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="var(--color-sales)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bookings"
                    stroke="var(--color-bookings)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </PrimaryChart>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Page Views" value={data.pageViews30d} description={`${data.uniqueVisitors30d} unique visitors · last 30 days`} icon={Eye} />
            <MetricCard title="Product Views" value={data.productViews30d} description="Shop detail interest · last 30 days" icon={ShoppingBag} />
            <MetricCard title="Sales Revenue" value={formatCurrency(data.salesRevenue30d, data.salesCurrency)} description={`${data.paidSales30d} paid sales · last 30 days`} icon={CreditCard} />
            <MetricCard title="Payment Starts" value={data.paymentSessionsCreated30d} description={`${paymentCompletionRate} completed · last 30 days`} icon={CreditCard} />
          </div>

          <Accordion type="multiple" defaultValue={["traffic", "studio"]} className="rounded-md border border-border bg-background px-4">
            <AccordionItem value="traffic">
              <AccordionTrigger>Traffic Health</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-6 md:grid-cols-3">
                  <MetricCard title="Checkout Abandons" value={data.checkoutAbandoned30d} description="Left checkout before payment start" icon={AlertTriangle} />
                  <MetricCard title="Open Payment Sessions" value={data.openPaymentSessions30d} description="Started payment minus completed webhooks" />
                  <MetricCard title="Payment Start Errors" value={data.paymentStartFailed30d} description="Customer reached pay click but Xendit did not start" />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="studio">
              <AccordionTrigger>Studio Activity</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard title="Total Orders" value={data.totalOrders} description={`${data.ordersThisMonth} this month`} icon={ClipboardList} />
                  <MetricCard title="Class Bookings" value={data.totalBookings} description={`${data.bookingsByStatus["PENDING"] || 0} pending`} icon={GraduationCap} />
                  <MetricCard title="POS / Shop Sales" value={formatCurrency(data.salesRevenueToday, data.salesCurrency)} description={`${data.paidSalesToday} paid today`} icon={ShoppingBag} />
                  <MetricCard title="Residency Apps" value={data.totalApplications} description={`${data.applicationsByStatus["SUBMITTED"] || 0} new`} icon={Calendar} />
                  <MetricCard
                    title="Registered Users"
                    value={data.totalUsers}
                    description={growthPercent ? `${growthPercent > 0 ? "+" : ""}${growthPercent}% orders vs last month` : "No order movement vs last month"}
                    icon={Users}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        <TabsContent value="locations" className="space-y-6">
          <SectionIntro title="Location Intelligence">
            Visitor location is captured from hosting/CDN geo headers when available. Click a place to focus page views and events.
          </SectionIntro>

          <PrimaryChart
            title="Top Visitor Countries"
            description={`${analyticsRangeDescription(locationChart.range)}. Ranked by page views with distinct visitors alongside.`}
            controls={<ChartRangeControls value={locationChart.range} onChange={locationChart.setRange} />}
            loading={locationChart.loading}
            error={locationChart.error}
          >
            {locationChart.points.length === 0 ? (
              <EmptyState>No location data recorded in this range</EmptyState>
            ) : (
              <ChartContainer config={locationChartConfig} className="h-[360px] w-full">
                <BarChart
                  accessibilityLayer
                  data={locationChart.points}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    width={132}
                    tickFormatter={(value) => formatChartLabel(String(value), 20)}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="views" fill="var(--color-views)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="visitors" fill="var(--color-visitors)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </PrimaryChart>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Known-location Views" value={knownLocationViews} description={`${unknownLocationViews} unknown · last 30 days`} icon={MapPin} />
            <MetricCard title="Top Country" value={topCountries[0]?.label || "No data"} description={topCountries[0] ? `${topCountries[0].views} views · ${topCountries[0].visitors} visitors · last 30 days` : "Waiting for traffic"} icon={Globe2} />
            <MetricCard title="Top Place" value={topLocations[0]?.label || "No data"} description={topLocations[0] ? `${topLocations[0].views} views · ${topLocations[0].signedInUsers} users · last 30 days` : "Waiting for traffic"} />
            <MetricCard title="Current Focus" value={selectedLocation?.label || "All locations"} description={selectedLocation ? `${filteredPageViews.length} recent views in focus` : "Showing all analytics"} />
          </div>

          <Accordion type="multiple" defaultValue={["top", "daily"]} className="rounded-md border border-border bg-background px-4">
            <AccordionItem value="top">
              <AccordionTrigger>Top Visitor Locations</AccordionTrigger>
              <AccordionContent>
                <div className="mb-4 flex justify-end">
                  {selectedLocation && (
                    <Button variant="outline" size="sm" onClick={() => setSelectedLocationKey("ALL")}>
                      Clear location focus
                    </Button>
                  )}
                </div>
                {topLocations.length === 0 ? (
                  <EmptyState>No location data recorded yet</EmptyState>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {topLocations.slice(0, 18).map((location) => (
                      <button
                        key={location.key}
                        type="button"
                        onClick={() => setSelectedLocationKey(location.key)}
                        className={`rounded-md border p-3 text-left transition-colors ${
                          selectedLocationKey === location.key
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{location.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {location.views} views · {location.visitors} visitors · {location.signedInUsers} users
                            </p>
                          </div>
                          <Badge variant={selectedLocationKey === location.key ? "default" : "secondary"}>
                            {location.country || "?"}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="countries">
              <AccordionTrigger>Countries</AccordionTrigger>
              <AccordionContent>
                {topCountries.length === 0 ? (
                  <EmptyState>No country data recorded yet</EmptyState>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {topCountries.map((country) => (
                      <div key={country.key} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                        <span className="truncate text-sm text-foreground">{country.label}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {country.views} views · {country.visitors} visitors
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="daily">
              <AccordionTrigger>Daily Top Locations</AccordionTrigger>
              <AccordionContent>
                {data.dailyLocationPageViews.length === 0 ? (
                  <EmptyState>No daily location data yet</EmptyState>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {data.dailyLocationPageViews.map((day) => (
                      <section key={day.date} className="rounded-md border border-border p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h3 className="text-sm font-medium text-foreground">{formatDateKey(day.date)}</h3>
                          <span className="text-xs text-muted-foreground">{day.totalViews} views</span>
                        </div>
                        <div className="space-y-2">
                          {day.locations.map((location) => (
                            <button
                              key={location.key}
                              type="button"
                              onClick={() => setSelectedLocationKey(location.key)}
                              className="flex w-full items-center justify-between gap-3 rounded bg-muted/40 px-3 py-2 text-left hover:bg-muted"
                            >
                              <span className="truncate text-xs text-muted-foreground">{location.label}</span>
                              <span className="shrink-0 text-xs font-semibold text-foreground">{location.views}</span>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        <TabsContent value="visitors" className="space-y-6">
          <SectionIntro title="Visitor Detail">
            Individual page views, daily user rankings, and hour-by-hour traffic patterns.
          </SectionIntro>

          <PrimaryChart
            title="Traffic Trend"
            description={`${analyticsRangeDescription(visitorChart.range)}. Page views and distinct visitors show both volume and reach.`}
            controls={<ChartRangeControls value={visitorChart.range} onChange={visitorChart.setRange} />}
            loading={visitorChart.loading}
            error={visitorChart.error}
          >
            {visitorChart.points.length === 0 ? (
              <EmptyState>No visitor activity recorded in this range</EmptyState>
            ) : (
              <ChartContainer config={visitorChartConfig} className="h-[320px] w-full">
                <LineChart
                  accessibilityLayer
                  data={visitorChart.points}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
                    tickFormatter={(value) => formatChartBucket(String(value), visitorChart.range)}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label) => formatChartBucket(String(label), visitorChart.range)}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="var(--color-views)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="visitors"
                    stroke="var(--color-visitors)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </PrimaryChart>

          <Accordion type="multiple" defaultValue={["latest", "rankings", "hourly"]} className="rounded-md border border-border bg-background px-4">
            <AccordionItem value="latest">
              <AccordionTrigger>Latest Page Views{selectedLocation ? ` · ${selectedLocation.label}` : ""}</AccordionTrigger>
              <AccordionContent>
                {filteredPageViews.length === 0 ? (
                  <EmptyState>No page views match this focus</EmptyState>
                ) : (
                  <div className="grid max-h-[620px] gap-3 overflow-y-auto pr-1 xl:grid-cols-2">
                    {filteredPageViews.map((view) => <PageViewRow key={view.id} view={view} />)}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="rankings">
              <AccordionTrigger>Daily User Rankings</AccordionTrigger>
              <AccordionContent>
                {data.dailyUserPageViewRankings.length === 0 ? (
                  <EmptyState>No daily rankings yet</EmptyState>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {data.dailyUserPageViewRankings.map((day) => (
                      <section key={day.date} className="rounded-md border border-border p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-medium text-foreground">{formatDateKey(day.date)}</h3>
                            <p className="text-xs text-muted-foreground">{day.totalViews} total page views</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {day.users.map((viewer, index) => (
                            <div key={viewer.key} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {index + 1}. {viewer.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {viewer.email || (viewer.visitorId ? `Visitor ${viewer.visitorId.slice(0, 8)}` : "Anonymous")}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-semibold text-foreground">{viewer.views}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="hourly">
              <AccordionTrigger>Daily Page Views Hour by Hour</AccordionTrigger>
              <AccordionContent>
                {data.dailyHourlyPageViews.length === 0 ? (
                  <EmptyState>No hourly page views yet</EmptyState>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1120px] text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="sticky left-0 bg-background px-3 py-2 text-left font-medium text-muted-foreground">Day</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                          {Array.from({ length: 24 }, (_, hour) => (
                            <th key={hour} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                              {String(hour).padStart(2, "0")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.dailyHourlyPageViews.map((day) => (
                          <tr key={day.date} className="border-b border-border last:border-0">
                            <td className="sticky left-0 whitespace-nowrap bg-background px-3 py-3 font-medium text-foreground">
                              {formatDateKey(day.date)}
                            </td>
                            <td className="px-3 py-3 text-right font-semibold text-foreground">{day.totalViews}</td>
                            {day.hours.map((hour) => (
                              <td key={hour.hour} className="px-1 py-2 text-center">
                                <div className="mx-auto flex h-12 w-8 flex-col justify-end rounded bg-muted/50 p-1" title={`${formatHour(hour.hour)}: ${hour.views} views`}>
                                  <div
                                    className="rounded-sm bg-primary"
                                    style={{ height: `${Math.max(4, (hour.views / maxHourlyViews) * 40)}px`, opacity: hour.views ? 1 : 0.15 }}
                                  />
                                </div>
                                <span className="mt-1 block text-[10px] text-muted-foreground">{hour.views}</span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        <TabsContent value="pages" className="space-y-6">
          <SectionIntro title="Page & Product Interest">
            See what people are viewing, then compare where that attention comes from.
          </SectionIntro>

          <PrimaryChart
            title="Most Viewed Pages"
            description={`${analyticsRangeDescription(pageChart.range)}. Ranked by recorded page views.`}
            controls={<ChartRangeControls value={pageChart.range} onChange={pageChart.setRange} />}
            loading={pageChart.loading}
            error={pageChart.error}
          >
            {pageChart.points.length === 0 ? (
              <EmptyState>No page views recorded in this range</EmptyState>
            ) : (
              <ChartContainer config={pageChartConfig} className="h-[380px] w-full">
                <BarChart
                  accessibilityLayer
                  data={pageChart.points}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    width={150}
                    tickFormatter={(value) => formatChartLabel(String(value), 24)}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="views" fill="var(--color-views)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </PrimaryChart>

          <Accordion type="multiple" defaultValue={["top-pages", "products", "page-location"]} className="rounded-md border border-border bg-background px-4">
            <AccordionItem value="top-pages">
              <AccordionTrigger>Top Pages</AccordionTrigger>
              <AccordionContent>
                {data.topPages.length === 0 ? (
                  <EmptyState>No page views recorded yet</EmptyState>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {data.topPages.map((page) => (
                      <div key={page.path} className="flex items-center justify-between gap-4 rounded-md bg-muted/40 px-3 py-2">
                        <span className="truncate text-sm text-muted-foreground">{page.path}</span>
                        <span className="text-sm font-medium text-foreground">{page.views}</span>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="products">
              <AccordionTrigger>Top Products</AccordionTrigger>
              <AccordionContent>
                {data.topProducts.length === 0 ? (
                  <EmptyState>No product views recorded yet</EmptyState>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {data.topProducts.map((product) => (
                      <div key={product.slug} className="flex items-center justify-between gap-4 rounded-md bg-muted/40 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.category}</p>
                        </div>
                        <span className="text-sm font-medium text-foreground">{product.views}</span>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="page-location">
              <AccordionTrigger>Page Views by Location</AccordionTrigger>
              <AccordionContent>
                {data.pageLocationBreakdown.length === 0 ? (
                  <EmptyState>No page-location data yet</EmptyState>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {data.pageLocationBreakdown.map((page) => (
                      <section key={page.path} className="rounded-md border border-border p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-medium text-foreground">{page.path}</p>
                          <span className="text-xs text-muted-foreground">{page.views} views</span>
                        </div>
                        <div className="space-y-2">
                          {page.locations.map((location) => (
                            <button
                              key={location.key}
                              type="button"
                              onClick={() => setSelectedLocationKey(location.key)}
                              className="flex w-full items-center justify-between gap-3 rounded bg-muted/40 px-3 py-2 text-left hover:bg-muted"
                            >
                              <span className="truncate text-xs text-muted-foreground">{location.label}</span>
                              <span className="shrink-0 text-xs font-semibold text-foreground">{location.views}</span>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          <SectionIntro title="Sales Metrics">
            POS and online shop sales from the recorded sale ledger, including payment mix, category mix, tax, discounts, voids, and daily revenue.
          </SectionIntro>

          {data.salesError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {data.salesError}
            </div>
          )}

          <PrimaryChart
            title="Sales Trend"
            description={`${analyticsRangeDescription(salesChart.range)}. Paid revenue and transactions for ${selectedSalesSeries?.label.toLowerCase() || "all sales"}.`}
            controls={
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2" aria-label="Sales chart category">
                  {data.salesCategorySeries.map((series) => (
                    <Button
                      key={series.category}
                      type="button"
                      size="sm"
                      variant={selectedSalesSeries?.category === series.category ? "default" : "outline"}
                      onClick={() => setSelectedSalesCategory(series.category)}
                    >
                      {series.label}
                    </Button>
                  ))}
                </div>
                <ChartRangeControls value={salesChart.range} onChange={salesChart.setRange} />
              </div>
            }
            loading={salesChart.loading}
            error={salesChart.error}
          >
            {salesChart.points.length === 0 ? (
              <EmptyState>No paid sales recorded in this range</EmptyState>
            ) : (
              <ChartContainer config={salesChartConfig} className="h-[300px] w-full">
                <LineChart
                  accessibilityLayer
                  data={salesChart.points}
                  margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
                    tickFormatter={(value) => formatChartBucket(String(value), salesChart.range)}
                  />
                  <YAxis
                    yAxisId="revenue"
                    tickLine={false}
                    axisLine={false}
                    width={72}
                    tickFormatter={(value) => formatCompactCurrency(Number(value), data.salesCurrency)}
                  />
                  <YAxis
                    yAxisId="sales"
                    orientation="right"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label) => formatChartBucket(String(label), salesChart.range)}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="sales"
                    type="monotone"
                    dataKey="sales"
                    stroke="var(--color-sales)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </PrimaryChart>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Paid Sales"
              value={formatCurrency(data.salesRevenue30d, data.salesCurrency)}
              description={`${data.paidSales30d} paid sales · last 30 days`}
              icon={CreditCard}
            />
            <MetricCard
              title="Today"
              value={formatCurrency(data.salesRevenueToday, data.salesCurrency)}
              description={`${data.paidSalesToday} paid sales today`}
              icon={ShoppingBag}
            />
            <MetricCard
              title="Average Sale"
              value={formatCurrency(data.averageSaleValue30d, data.salesCurrency)}
              description={`${formatCurrency(data.salesTax30d, data.salesCurrency)} tax · last 30 days`}
              icon={TrendingUp}
            />
            <MetricCard
              title="Voids"
              value={data.voidedSales30d}
              description={`${salesVoidRate} finalized/voided · ${formatCurrency(data.voidedSalesTotal30d, data.salesCurrency)} · last 30 days`}
              icon={AlertTriangle}
            />
          </div>

          <Accordion type="multiple" defaultValue={["payment", "category", "daily"]} className="rounded-md border border-border bg-background px-4">
            <AccordionItem value="totals">
              <AccordionTrigger>Sales Totals</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard title="Gross Subtotal" value={formatCurrency(data.salesSubtotal30d, data.salesCurrency)} description="Before discounts and tax" />
                  <MetricCard title="Discounts" value={formatCurrency(data.salesDiscount30d, data.salesCurrency)} description="Total discount given" />
                  <MetricCard title="Tax" value={formatCurrency(data.salesTax30d, data.salesCurrency)} description="Tax collected on paid sales" />
                  <MetricCard title="Pending Online" value={formatCurrency(data.pendingSalesTotal30d, data.salesCurrency)} description={`${data.pendingSales30d} pending payment sessions`} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="payment">
              <AccordionTrigger>Payment Method Mix</AccordionTrigger>
              <AccordionContent>
                {data.salesByPaymentMethod.length === 0 ? (
                  <EmptyState>No paid sales recorded in this window</EmptyState>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {data.salesByPaymentMethod.map((method) => (
                      <div key={method.method} className="rounded-md border border-border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">{formatPaymentMethod(method.method)}</p>
                          <Badge variant="secondary">{method.sales} sales</Badge>
                        </div>
                        <p className="mt-2 text-xl font-semibold text-foreground">
                          {formatCurrency(method.revenue, data.salesCurrency)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="category">
              <AccordionTrigger>Sales by Category</AccordionTrigger>
              <AccordionContent>
                {data.salesByCategory.length === 0 ? (
                  <EmptyState>No category sales recorded in this window</EmptyState>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Category</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Items</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Gross</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Discount</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Tax</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.salesByCategory.map((category) => (
                          <tr key={category.category} className="border-b border-border last:border-0">
                            <td className="px-3 py-3 font-medium text-foreground">{category.label}</td>
                            <td className="px-3 py-3 text-right text-muted-foreground">{category.quantity}</td>
                            <td className="px-3 py-3 text-right text-muted-foreground">{formatCurrency(category.gross, data.salesCurrency)}</td>
                            <td className="px-3 py-3 text-right text-muted-foreground">{formatCurrency(category.discount, data.salesCurrency)}</td>
                            <td className="px-3 py-3 text-right text-muted-foreground">{formatCurrency(category.tax, data.salesCurrency)}</td>
                            <td className="px-3 py-3 text-right font-semibold text-foreground">{formatCurrency(category.revenue, data.salesCurrency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="daily">
              <AccordionTrigger>Daily Sales</AccordionTrigger>
              <AccordionContent>
                {data.dailySales.length === 0 ? (
                  <EmptyState>No daily sales recorded in this window</EmptyState>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {data.dailySales.map((day) => (
                      <div key={day.date} className="rounded-md bg-muted/40 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">{formatDateKey(day.date)}</p>
                          <span className="text-xs text-muted-foreground">{day.sales} sales</span>
                        </div>
                        <p className="mt-2 text-xl font-semibold text-foreground">
                          {formatCurrency(day.revenue, data.salesCurrency)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Tax {formatCurrency(day.tax, data.salesCurrency)} · Discount {formatCurrency(day.discount, data.salesCurrency)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="recent">
              <AccordionTrigger>Recent Sales</AccordionTrigger>
              <AccordionContent>
                {data.recentSales.length === 0 ? (
                  <EmptyState>No recent sales recorded</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {data.recentSales.map((sale) => (
                      <div key={sale.id} className="flex flex-col gap-3 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">{sale.id}</p>
                            <Badge variant={sale.status === "PAID" ? "default" : sale.status === "VOIDED" ? "destructive" : "secondary"}>
                              {sale.status.replace(/_/g, " ").toLowerCase()}
                            </Badge>
                            <Badge variant="outline">{formatPaymentMethod(sale.paymentMethod)}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {sale.itemCount} items · {sale.operatorName} · {new Date(sale.createdAt).toLocaleString()}
                          </p>
                          {sale.receiptEmail && <p className="text-xs text-muted-foreground">Receipt: {sale.receiptEmail}</p>}
                        </div>
                        <div className="text-left md:text-right">
                          <p className="text-base font-semibold text-foreground">{formatCurrency(sale.total, sale.currency)}</p>
                          <p className="text-xs text-muted-foreground">
                            Tax {formatCurrency(sale.taxTotal, sale.currency)} · Discount {formatCurrency(sale.discountTotal, sale.currency)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        <TabsContent value="classes" className="space-y-6">
          <SectionIntro title="Class Booking Metrics">
            Confirmed bookings, seats reserved, and pending requests by booking date and class category.
          </SectionIntro>

          <PrimaryChart
            title="Class Booking Trend"
            description={`${analyticsRangeDescription(classChart.range)}. Confirmed bookings, seats, and pending requests for ${selectedClassSeries?.label.toLowerCase() || "all classes"}.`}
            controls={
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2" aria-label="Class chart category">
                  {data.classCategorySeries.map((series) => (
                    <Button
                      key={series.category}
                      type="button"
                      size="sm"
                      variant={selectedClassSeries?.category === series.category ? "default" : "outline"}
                      onClick={() => setSelectedClassCategory(series.category)}
                    >
                      {series.label}
                    </Button>
                  ))}
                </div>
                <ChartRangeControls value={classChart.range} onChange={classChart.setRange} />
              </div>
            }
            loading={classChart.loading}
            error={classChart.error}
          >
            {classChart.points.length === 0 ? (
              <EmptyState>No class bookings recorded in this range</EmptyState>
            ) : (
              <ChartContainer config={classChartConfig} className="h-[300px] w-full">
                <LineChart
                  accessibilityLayer
                  data={classChart.points}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
                    tickFormatter={(value) => formatChartBucket(String(value), classChart.range)}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label) => formatChartBucket(String(label), classChart.range)}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    type="monotone"
                    dataKey="seats"
                    stroke="var(--color-seats)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bookings"
                    stroke="var(--color-bookings)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pendingBookings"
                    stroke="var(--color-pendingBookings)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </PrimaryChart>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Confirmed Bookings"
              value={data.confirmedClassBookings30d}
              description="Last 30 days"
              icon={GraduationCap}
            />
            <MetricCard
              title="Confirmed Seats"
              value={data.confirmedClassSeats30d}
              description="Confirmed seats · last 30 days"
              icon={Users}
            />
            <MetricCard
              title="Pending Bookings"
              value={data.pendingClassBookings30d}
              description={`${data.pendingClassSeats30d} seats · last 30 days`}
              icon={Calendar}
            />
            <MetricCard
              title="Completion Share"
              value={rate(
                data.confirmedClassBookings30d,
                data.confirmedClassBookings30d + data.pendingClassBookings30d
              )}
              description="Confirmed share · last 30 days"
              icon={TrendingUp}
            />
          </div>
        </TabsContent>

        <TabsContent value="conversion" className="space-y-6">
          <SectionIntro title="Checkout & Payment Funnel">
            Track intent to buy, payment starts, failures, and completed payment sessions.
          </SectionIntro>

          <PrimaryChart
            title="Payment Funnel"
            description={`${analyticsRangeDescription(conversionChart.range)}. Compare checkout reach with payment intent and completed sessions.`}
            controls={<ChartRangeControls value={conversionChart.range} onChange={conversionChart.setRange} />}
            loading={conversionChart.loading}
            error={conversionChart.error}
          >
            {conversionChart.points.length === 0 ? (
              <EmptyState>No checkout activity recorded in this range</EmptyState>
            ) : (
              <ChartContainer config={conversionChartConfig} className="h-[260px] w-full">
                <BarChart
                  accessibilityLayer
                  data={conversionChart.points}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    width={128}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </PrimaryChart>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Checkout Views" value={data.checkoutViews30d} description="Reached checkout · last 30 days" icon={Eye} />
            <MetricCard title="Clicked Pay" value={data.paymentIntentClicks30d} description={`${checkoutClickRate} of checkout views · last 30 days`} icon={MousePointerClick} />
            <MetricCard title="Payment Sessions" value={data.paymentSessionsCreated30d} description={`${paymentCompletionRate} completed · last 30 days`} icon={CreditCard} />
            <MetricCard title="Payment Errors" value={data.paymentStartFailed30d} description="Before payment handoff · last 30 days" icon={AlertTriangle} />
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <SectionIntro title="Event Feed">
            Recent analytics events with connected users, visitor identities, timestamps, and locations.
          </SectionIntro>

          <PrimaryChart
            title="Event Type Mix"
            description={`${analyticsRangeDescription(eventChart.range)}. The most frequent tracked actions across the site.`}
            controls={<ChartRangeControls value={eventChart.range} onChange={eventChart.setRange} />}
            loading={eventChart.loading}
            error={eventChart.error}
          >
            {eventChart.points.length === 0 ? (
              <EmptyState>No analytics events recorded in this range</EmptyState>
            ) : (
              <ChartContainer config={eventChartConfig} className="h-[380px] w-full">
                <BarChart
                  accessibilityLayer
                  data={eventChart.points}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    width={150}
                    tickFormatter={(value) => formatChartLabel(formatEventType(String(value)), 24)}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </PrimaryChart>

          <Accordion type="multiple" defaultValue={["recent", "orders"]} className="rounded-md border border-border bg-background px-4">
            <AccordionItem value="recent">
              <AccordionTrigger>Recent Events{selectedLocation ? ` · ${selectedLocation.label}` : ""}</AccordionTrigger>
              <AccordionContent>
                {filteredRecentEvents.length === 0 ? (
                  <EmptyState>No recent events match this focus</EmptyState>
                ) : (
                  <div className="max-h-[620px] overflow-y-auto pr-1">
                    {filteredRecentEvents.map((event) => <EventRow key={event.id} event={event} />)}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="orders">
              <AccordionTrigger>Recent Orders</AccordionTrigger>
              <AccordionContent>
                {!data.recentOrders.length ? (
                  <EmptyState>No orders yet</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {data.recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between gap-4 rounded-md bg-muted/40 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{order.contactName}</p>
                          <p className="text-xs text-muted-foreground">{order.status.replace(/_/g, " ").toLowerCase()}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  )
}
