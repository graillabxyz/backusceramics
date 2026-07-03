"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  CreditCard,
  Eye,
  GraduationCap,
  Loader2,
  MousePointerClick,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react"

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
  topPages: Array<{ path: string; views: number }>
  topProducts: Array<{ slug: string; name: string; category: string; views: number }>
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
  }>
}

function rate(part: number, whole: number) {
  if (!whole) return "0%"
  return `${Math.round((part / whole) * 100)}%`
}

function formatEventType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-bold text-3xl text-foreground">Analytics</h1>
        <p className="text-muted-foreground mt-1">Customer traffic, checkout intent, and studio activity</p>
      </div>

      <div>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-xl font-semibold text-foreground">Site behavior</h2>
            <p className="text-sm text-muted-foreground">Last {data.analyticsWindowDays} days</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Page Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{data.pageViews30d}</p>
              <p className="text-xs text-muted-foreground mt-1">{data.uniqueVisitors30d} unique visitors</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Product Views</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{data.productViews30d}</p>
              <p className="text-xs text-muted-foreground mt-1">Shop detail page interest</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Checkout Intent</CardTitle>
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{data.checkoutViews30d}</p>
              <p className="text-xs text-muted-foreground mt-1">{checkoutClickRate} clicked pay</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Payment Starts</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{data.paymentSessionsCreated30d}</p>
              <p className="text-xs text-muted-foreground mt-1">{paymentCompletionRate} completed by webhook</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Checkout Abandons</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{data.checkoutAbandoned30d}</p>
              <p className="text-xs text-muted-foreground mt-1">Left checkout before payment start</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Payment Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{data.openPaymentSessions30d}</p>
              <p className="text-xs text-muted-foreground mt-1">Started payment minus completed webhooks</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Payment Start Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{data.paymentStartFailed30d}</p>
              <p className="text-xs text-muted-foreground mt-1">Customer reached pay click but Xendit did not start</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Studio Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{data.totalOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.ordersThisMonth} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Class Bookings</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{data.totalBookings}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.bookingsByStatus["PENDING"] || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Residency Apps</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{data.totalApplications}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.applicationsByStatus["SUBMITTED"] || 0} new
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Registered Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{data.totalUsers}</p>
            {growthPercent !== 0 && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${growthPercent > 0 ? "text-green-600" : "text-red-600"}`}>
                <TrendingUp className="h-3 w-3" />
                {growthPercent > 0 ? "+" : ""}{growthPercent}% orders vs last month
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading font-bold text-lg">Top Pages</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No page views recorded yet</p>
            ) : (
              <div className="space-y-3">
                {data.topPages.map((page) => (
                  <div key={page.path} className="flex items-center justify-between gap-4">
                    <span className="truncate text-sm text-muted-foreground">{page.path}</span>
                    <span className="text-sm font-medium text-foreground">{page.views}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading font-bold text-lg">Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No product views recorded yet</p>
            ) : (
              <div className="space-y-3">
                {data.topProducts.map((product) => (
                  <div key={product.slug} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.category}</p>
                    </div>
                    <span className="text-sm font-medium text-foreground">{product.views}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Status Breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading font-bold text-lg">Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(data.ordersByStatus).length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(data.ordersByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground capitalize">
                      {status.replace(/_/g, " ").toLowerCase()}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min(100, (count / data.totalOrders) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading font-bold text-lg">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet</p>
            ) : (
              <div className="space-y-3">
                {data.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{order.contactName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">
                      {order.status.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading font-bold text-lg">Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No analytics events recorded yet</p>
          ) : (
            <div className="space-y-3">
              {data.recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{formatEventType(event.type)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {event.productName || event.workshopTitle || event.path || event.source || "Site event"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
