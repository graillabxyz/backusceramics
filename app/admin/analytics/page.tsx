"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, TrendingUp, ClipboardList, GraduationCap, Users, Calendar } from "lucide-react"

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-bold text-3xl text-foreground">Analytics</h1>
        <p className="text-muted-foreground mt-1">Overview of your studio activity</p>
      </div>

      {/* Summary Stats */}
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
    </div>
  )
}
