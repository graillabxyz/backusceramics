"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, ShoppingBag, ClipboardList, Users, Calendar, Loader2, BarChart3, Store } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { canManageAdmins, canUsePos, isFullAdminRole } from "@/lib/permissions"

interface DashboardStats {
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

const statusLabels: Record<string, string> = {
  INQUIRY: "New Inquiry", REVIEWING: "Reviewing", QUOTED: "Quoted",
  ACCEPTED: "Accepted", IN_PROGRESS: "In Progress", GLAZING: "Glazing",
  FIRING: "Firing", COMPLETED: "Completed", SHIPPED: "Shipped", CANCELLED: "Cancelled",
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.ok ? res.json() : null)
      .then(setStats)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const pendingOrders = stats?.ordersByStatus?.INQUIRY || 0
  const activeOrders = (stats?.ordersByStatus?.IN_PROGRESS || 0) +
    (stats?.ordersByStatus?.GLAZING || 0) + (stats?.ordersByStatus?.FIRING || 0)
  const pendingBookings = stats?.bookingsByStatus?.PENDING || 0
  const newApplications = stats?.applicationsByStatus?.SUBMITTED || 0
  const canOpenAdminTools = isFullAdminRole(user?.role)
  const canOpenPos = canUsePos(user?.role)
  const canOpenUserRoles = canManageAdmins(user?.role)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-bold text-3xl font-medium text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here&apos;s an overview of your studio.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Orders
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{stats?.totalOrders || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingOrders} pending review · {activeOrders} in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Class Bookings
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{stats?.totalBookings || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingBookings} pending confirmation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Residency Apps
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{stats?.totalApplications || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {newApplications} awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Registered Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{stats?.totalUsers || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.ordersThisMonth || 0} orders this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {canOpenAdminTools && (
          <>
            <Link href="/admin/orders">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <ClipboardList className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="font-heading font-bold text-xl">Manage Orders</CardTitle>
                  <CardDescription>
                    View inquiries, update statuses, and add progress updates
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/bookings">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <GraduationCap className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="font-heading font-bold text-xl">Class Bookings</CardTitle>
                  <CardDescription>
                    Confirm workshop bookings and manage the class schedule
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/products">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <ShoppingBag className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="font-heading font-bold text-xl">Products</CardTitle>
                  <CardDescription>
                    Add wares, cafe items, prices, inventory, and sales visibility
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/analytics">
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="font-heading font-bold text-xl">Analytics</CardTitle>
                  <CardDescription>
                    View trends, status breakdowns, and activity metrics
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </>
        )}

        {canOpenPos && (
          <Link href="/admin/pos">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Store className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-heading font-bold text-xl">Point of Sale</CardTitle>
                <CardDescription>
                  Open the cashier register, add quick products, and record sales
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}

        {canOpenUserRoles && (
          <Link href="/admin/users">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-heading font-bold text-xl">Users & Roles</CardTitle>
                <CardDescription>
                  See every auth user and assign manager, admin, owner, or POS access
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading font-bold text-xl">Recent Orders</CardTitle>
          <CardDescription>Latest order inquiries</CardDescription>
        </CardHeader>
        <CardContent>
          {!stats?.recentOrders?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No orders yet. They&apos;ll appear here when customers submit inquiries.
            </p>
          ) : (
            <div className="space-y-4">
              {stats.recentOrders.map((order) => (
                <Link key={order.id} href={`/admin/orders/${order.id}`}>
                  <div className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:bg-muted/50 rounded px-2 transition-colors">
                    <div>
                      <p className="font-medium text-foreground text-sm">{order.contactName}</p>
                      <p className="text-muted-foreground text-sm capitalize">
                        {(statusLabels[order.status] || order.status).toLowerCase()}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
