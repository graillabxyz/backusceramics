"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, GraduationCap, ShoppingBag, ClipboardList, Users, Calendar, Loader2, BarChart3, Store, Link2 } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { canManageAdmins, canUsePos, canViewAnalytics, isFullAdminRole } from "@/lib/permissions"
import { MenuPerformanceSummary } from "@/components/admin/menu-performance-summary"

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
  const canOpenAnalytics = canViewAnalytics(user?.role)

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Studio overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">Good to see you, {user?.name?.split(" ")[0] || "there"}.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Bookings, orders, sales, and the work that needs attention today.</p>
        </div>
        {canOpenAnalytics && <Link href="/admin/analytics" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-foreground hover:text-primary">Open analytics <ArrowRight className="h-4 w-4" /></Link>}
      </div>

      {/* Stats Grid */}
      <div className="grid overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-none border-0 shadow-none">
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

        <Card className="rounded-none border-0 shadow-none">
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

        <Card className="rounded-none border-0 shadow-none">
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

        <Card className="rounded-none border-0 shadow-none">
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

      {canOpenAnalytics && <MenuPerformanceSummary />}

      {/* Quick Actions */}
      <section>
        <div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Workspaces</h2><p className="text-sm text-muted-foreground">Go straight to the task at hand.</p></div></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {canOpenAdminTools && (
          <>
            <Link href="/admin/orders">
              <Card className="h-full cursor-pointer transition-colors hover:border-primary/35 hover:bg-muted/20">
                <CardHeader className="p-5">
                  <div className="mb-1 flex items-center justify-between"><ClipboardList className="h-5 w-5 text-primary" /><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
                  <CardTitle className="text-base font-semibold">Manage Orders</CardTitle>
                  <CardDescription>
                    View inquiries, update statuses, and add progress updates
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/bookings">
              <Card className="h-full cursor-pointer transition-colors hover:border-primary/35 hover:bg-muted/20">
                <CardHeader className="p-5">
                  <div className="mb-1 flex items-center justify-between"><GraduationCap className="h-5 w-5 text-primary" /><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
                  <CardTitle className="text-base font-semibold">Class Bookings</CardTitle>
                  <CardDescription>
                    Confirm workshop bookings and manage the class schedule
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/products">
              <Card className="h-full cursor-pointer transition-colors hover:border-primary/35 hover:bg-muted/20">
                <CardHeader className="p-5">
                  <div className="mb-1 flex items-center justify-between"><ShoppingBag className="h-5 w-5 text-primary" /><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
                  <CardTitle className="text-base font-semibold">Products</CardTitle>
                  <CardDescription>
                    Add wares, cafe items, prices, inventory, and sales visibility
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

          </>
        )}

        {canOpenAnalytics && (
          <Link href="/admin/payment-links">
            <Card className="h-full cursor-pointer transition-colors hover:border-primary/35 hover:bg-muted/20">
              <CardHeader className="p-5">
                <div className="mb-1 flex items-center justify-between"><Link2 className="h-5 w-5 text-primary" /><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
                <CardTitle className="text-base font-semibold">Payment Links</CardTitle>
                <CardDescription>Create a secure custom-order, shipping, or deposit payment link</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}

        {canOpenAnalytics && (
          <Link href="/admin/analytics">
            <Card className="h-full cursor-pointer transition-colors hover:border-primary/35 hover:bg-muted/20">
              <CardHeader className="p-5">
                <div className="mb-1 flex items-center justify-between"><BarChart3 className="h-5 w-5 text-primary" /><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
                <CardTitle className="text-base font-semibold">Analytics</CardTitle>
                <CardDescription>
                  View trends, status breakdowns, and activity metrics
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}

        {canOpenPos && (
          <Link href="/admin/pos">
            <Card className="h-full cursor-pointer transition-colors hover:border-primary/35 hover:bg-muted/20">
              <CardHeader className="p-5">
                <div className="mb-1 flex items-center justify-between"><Store className="h-5 w-5 text-primary" /><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
                <CardTitle className="text-base font-semibold">Point of Sale</CardTitle>
                <CardDescription>
                  Open the cashier register, add quick products, and record sales
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}

        {canOpenUserRoles && (
          <Link href="/admin/users">
            <Card className="h-full cursor-pointer transition-colors hover:border-primary/35 hover:bg-muted/20">
              <CardHeader className="p-5">
                <div className="mb-1 flex items-center justify-between"><Users className="h-5 w-5 text-primary" /><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
                <CardTitle className="text-base font-semibold">Users & Roles</CardTitle>
                <CardDescription>
                  See every auth user and assign manager, admin, owner, or POS access
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}
      </div>
      </section>

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
