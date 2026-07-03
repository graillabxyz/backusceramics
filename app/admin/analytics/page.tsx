"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  analyticsWindowDays: number
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

function SectionIntro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-heading text-xl font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
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

  useEffect(() => {
    fetchAnalytics()
  }, [])

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
  const sortedEventCounts = Object.entries(data.eventCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 18)

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
          <Badge variant="secondary">Last {data.analyticsWindowDays} days</Badge>
          <Badge variant="outline">{data.analyticsTimeZone}</Badge>
          <Badge variant={selectedLocation ? "default" : "secondary"}>
            {selectedLocation ? `Focused: ${selectedLocation.label}` : "All locations"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted p-1 md:grid-cols-3 xl:grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="visitors">Visitors</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="conversion">Conversion</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SectionIntro title="Executive View">
            Fast read on site traffic, sales intent, and operational volume.
          </SectionIntro>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Page Views" value={data.pageViews30d} description={`${data.uniqueVisitors30d} unique visitors`} icon={Eye} />
            <MetricCard title="Product Views" value={data.productViews30d} description="Shop detail page interest" icon={ShoppingBag} />
            <MetricCard title="Checkout Intent" value={data.checkoutViews30d} description={`${checkoutClickRate} clicked pay`} icon={MousePointerClick} />
            <MetricCard title="Payment Starts" value={data.paymentSessionsCreated30d} description={`${paymentCompletionRate} completed by webhook`} icon={CreditCard} />
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

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Known-location Views" value={knownLocationViews} description={`${unknownLocationViews} views still unknown`} icon={MapPin} />
            <MetricCard title="Top Country" value={topCountries[0]?.label || "No data"} description={topCountries[0] ? `${topCountries[0].views} views · ${topCountries[0].visitors} visitors` : "Waiting for traffic"} icon={Globe2} />
            <MetricCard title="Top Place" value={topLocations[0]?.label || "No data"} description={topLocations[0] ? `${topLocations[0].views} views · ${topLocations[0].signedInUsers} users` : "Waiting for traffic"} />
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

        <TabsContent value="conversion" className="space-y-6">
          <SectionIntro title="Checkout & Payment Funnel">
            Track intent to buy, payment starts, failures, and completed payment sessions.
          </SectionIntro>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Checkout Views" value={data.checkoutViews30d} description="People who reached checkout" icon={Eye} />
            <MetricCard title="Clicked Pay" value={data.paymentIntentClicks30d} description={`${checkoutClickRate} of checkout views`} icon={MousePointerClick} />
            <MetricCard title="Payment Sessions" value={data.paymentSessionsCreated30d} description={`${paymentCompletionRate} completed`} icon={CreditCard} />
            <MetricCard title="Payment Errors" value={data.paymentStartFailed30d} description="Failed before payment handoff" icon={AlertTriangle} />
          </div>

          <Accordion type="multiple" defaultValue={["events"]} className="rounded-md border border-border bg-background px-4">
            <AccordionItem value="events">
              <AccordionTrigger>Event Type Mix</AccordionTrigger>
              <AccordionContent>
                {sortedEventCounts.length === 0 ? (
                  <EmptyState>No analytics events recorded yet</EmptyState>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {sortedEventCounts.map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                        <span className="truncate text-sm text-muted-foreground">{formatEventType(type)}</span>
                        <span className="text-sm font-semibold text-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <SectionIntro title="Event Feed">
            Recent analytics events with connected users, visitor identities, timestamps, and locations.
          </SectionIntro>

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
