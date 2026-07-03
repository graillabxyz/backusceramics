"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, HelpCircle, Loader2, Shield, Users as UsersIcon } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { appRoles, canManageAdmins, roleAccessDescriptions, roleLabels, type AppRole } from "@/lib/permissions"

interface UserMetrics {
  pageViews: number
  productViews: number
  checkoutViews: number
  checkoutIntentClicks: number
  paymentIntentClicks: number
  paymentSessionsCreated: number
  paymentsCompleted: number
  checkoutAbandoned: number
  paymentStartFailed: number
  totalEvents: number
  confirmedClassBookings: number
  completedClassBookings: number
  pendingClassBookings: number
  cancelledClassBookings: number
  posReceiptPurchases: number
  posReceiptSpend: number
  lastActivityAt: string | null
}

interface UserData {
  id: string
  name: string | null
  email: string
  role: string
  image: string | null
  createdAt: string
  hasLocalUser?: boolean
  hasSupabaseAuth?: boolean
  authCreatedAt?: string | null
  lastSignInAt?: string | null
  authProvider?: string | null
  purchaseCount?: number
  metrics?: UserMetrics
  _count: {
    orders: number
    classBookings: number
    residencyApps: number
    posSales: number
  }
}

interface UsersApiResponse {
  users: UserData[]
  authSync?: {
    enabled: boolean
    error: string | null
    authUserCount: number
    createdFromAuth: number
  }
}

type SortDirection = "asc" | "desc"
type SortKey =
  | "name"
  | "email"
  | "role"
  | "lastSignInAt"
  | "lastActivityAt"
  | "pageViews"
  | "productViews"
  | "checkoutViews"
  | "paymentIntentClicks"
  | "checkoutAbandoned"
  | "purchases"
  | "posSales"
  | "joined"

const numberFormatter = new Intl.NumberFormat("en-US")
const rupiahFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
})

function emptyMetrics(): UserMetrics {
  return {
    pageViews: 0,
    productViews: 0,
    checkoutViews: 0,
    checkoutIntentClicks: 0,
    paymentIntentClicks: 0,
    paymentSessionsCreated: 0,
    paymentsCompleted: 0,
    checkoutAbandoned: 0,
    paymentStartFailed: 0,
    totalEvents: 0,
    confirmedClassBookings: 0,
    completedClassBookings: 0,
    pendingClassBookings: 0,
    cancelledClassBookings: 0,
    posReceiptPurchases: 0,
    posReceiptSpend: 0,
    lastActivityAt: null,
  }
}

function getMetrics(user: UserData) {
  return user.metrics || emptyMetrics()
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
}

function formatDateTime(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function dateSortValue(value?: string | null) {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function formatNumber(value: number) {
  return numberFormatter.format(value)
}

function formatCurrency(value: number) {
  return rupiahFormatter.format(value)
}

function RoleAccessTooltip({ role }: { role: AppRole }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`${roleLabels[role]} access details`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" align="center" className="max-w-72 text-pretty leading-relaxed">
        {roleAccessDescriptions[role]}
      </TooltipContent>
    </Tooltip>
  )
}

function purchaseCount(user: UserData) {
  const metrics = getMetrics(user)
  return user.purchaseCount ?? (
    user._count.orders +
    metrics.confirmedClassBookings +
    metrics.completedClassBookings +
    metrics.posReceiptPurchases
  )
}

function getSortValue(user: UserData, key: SortKey) {
  const metrics = getMetrics(user)

  switch (key) {
    case "name":
      return (user.name || user.email).toLowerCase()
    case "email":
      return user.email.toLowerCase()
    case "role":
      return roleLabels[user.role as AppRole] || user.role
    case "lastSignInAt":
      return dateSortValue(user.lastSignInAt)
    case "lastActivityAt":
      return dateSortValue(metrics.lastActivityAt)
    case "pageViews":
      return metrics.pageViews
    case "productViews":
      return metrics.productViews
    case "checkoutViews":
      return metrics.checkoutViews
    case "paymentIntentClicks":
      return metrics.paymentIntentClicks
    case "checkoutAbandoned":
      return metrics.checkoutAbandoned
    case "purchases":
      return purchaseCount(user)
    case "posSales":
      return user._count.posSales
    case "joined":
      return dateSortValue(user.authCreatedAt || user.createdAt)
  }
}

export default function AdminUsersPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth()
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authSync, setAuthSync] = useState<UsersApiResponse["authSync"]>(undefined)
  const [sortKey, setSortKey] = useState<SortKey>("lastSignInAt")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const canEditRoles = canManageAdmins(currentUser?.role)

  useEffect(() => {
    if (!authLoading) {
      fetchUsers()
    }
  }, [authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentUserFallback = (): UserData | null => {
    if (!currentUser?.email) return null

    return {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      role: currentUser.role,
      image: currentUser.image || null,
      createdAt: new Date().toISOString(),
      hasLocalUser: false,
      hasSupabaseAuth: true,
      authCreatedAt: null,
      lastSignInAt: null,
      authProvider: null,
      purchaseCount: 0,
      metrics: emptyMetrics(),
      _count: {
        orders: 0,
        classBookings: 0,
        residencyApps: 0,
        posSales: 0,
      },
    }
  }

  const fetchUsers = async () => {
    try {
      setError(null)
      const res = await fetch("/api/users")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const fallbackMessage = res.status === 401
          ? "Your admin session could not be verified. Please sign in again."
          : `Could not load users. (${res.status})`
        throw new Error(data.error || fallbackMessage)
      }

      if (Array.isArray(data)) {
        setUsers(data)
        setAuthSync(undefined)
      } else {
        const payload = data as UsersApiResponse
        setUsers(payload.users || [])
        setAuthSync(payload.authSync)
      }
    } catch (err) {
      console.error("Failed to fetch users:", err)
      const fallbackUser = currentUserFallback()
      if (fallbackUser) {
        setUsers([fallbackUser])
        setAuthSync({
          enabled: false,
          error: "Could not reach the full user directory. Showing your current signed-in admin session only.",
          authUserCount: 0,
          createdFromAuth: 0,
        })
      }
      setError(err instanceof Error ? err.message : "Could not load users.")
    } finally {
      setLoading(false)
    }
  }

  const updateRole = async (id: string, role: AppRole) => {
    if (!canEditRoles) return
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, role } : u))
        )
      }
    } catch (err) {
      console.error("Failed to update role:", err)
    }
  }

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aValue = getSortValue(a, sortKey)
      const bValue = getSortValue(b, sortKey)
      const direction = sortDirection === "asc" ? 1 : -1

      if (typeof aValue === "string" || typeof bValue === "string") {
        return String(aValue).localeCompare(String(bValue)) * direction
      }

      return (Number(aValue) - Number(bValue)) * direction
    })
  }, [sortDirection, sortKey, users])

  const totals = useMemo(() => {
    return users.reduce(
      (summary, user) => {
        const metrics = getMetrics(user)
        summary.pageViews += metrics.pageViews
        summary.checkoutViews += metrics.checkoutViews
        summary.paymentIntentClicks += metrics.paymentIntentClicks
        summary.purchases += purchaseCount(user)
        return summary
      },
      { pageViews: 0, checkoutViews: 0, paymentIntentClicks: 0, purchases: 0 }
    )
  }, [users])

  const setSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc")
      return
    }

    setSortKey(key)
    setSortDirection(key === "name" || key === "email" || key === "role" ? "asc" : "desc")
  }

  const SortHeader = ({ column, label, align = "left" }: { column: SortKey; label: string; align?: "left" | "right" }) => {
    const active = sortKey === column
    const Icon = active ? (sortDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown

    return (
      <button
        type="button"
        onClick={() => setSort(column)}
        className={`inline-flex w-full items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground ${align === "right" ? "justify-end" : "justify-start"}`}
      >
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </button>
    )
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-3xl text-foreground">Users</h1>
        <p className="text-muted-foreground mt-1">
          Manage every account that has gone through site auth{canEditRoles ? " and roles" : ". Owner admin controls role changes."}
        </p>
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={fetchUsers}
          >
            Retry
          </Button>
        </div>
      )}

      {authSync?.error && (
        <div className="flex gap-3 rounded-md border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Supabase Auth sync did not fully complete.</p>
            <p className="mt-1">
              Showing local users only where auth records could not be read. {authSync.error}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Visible users</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(users.length)}</p>
        </div>
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Supabase auth users</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{authSync?.authUserCount ?? "—"}</p>
        </div>
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Tracked page views</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(totals.pageViews)}</p>
        </div>
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Checkout / pay intent</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {formatNumber(totals.checkoutViews)} / {formatNumber(totals.paymentIntentClicks)}
          </p>
        </div>
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Purchases tracked</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(totals.purchases)}</p>
        </div>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <UsersIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="font-heading font-bold text-lg mb-2">No users yet</CardTitle>
            <CardDescription>Users will appear here when they sign in.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1320px] text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left"><SortHeader column="name" label="User" /></th>
                    <th className="px-4 py-3 text-left"><SortHeader column="role" label="Role" /></th>
                    <th className="px-4 py-3 text-left"><SortHeader column="lastSignInAt" label="Last login" /></th>
                    <th className="px-4 py-3 text-left"><SortHeader column="lastActivityAt" label="Last activity" /></th>
                    <th className="px-4 py-3 text-right"><SortHeader column="pageViews" label="Pages" align="right" /></th>
                    <th className="px-4 py-3 text-right"><SortHeader column="productViews" label="Products" align="right" /></th>
                    <th className="px-4 py-3 text-right"><SortHeader column="checkoutViews" label="Checkout" align="right" /></th>
                    <th className="px-4 py-3 text-right"><SortHeader column="paymentIntentClicks" label="Pay clicks" align="right" /></th>
                    <th className="px-4 py-3 text-right"><SortHeader column="checkoutAbandoned" label="Abandoned" align="right" /></th>
                    <th className="px-4 py-3 text-right"><SortHeader column="purchases" label="Purchases" align="right" /></th>
                    <th className="px-4 py-3 text-right"><SortHeader column="posSales" label="POS ops" align="right" /></th>
                    <th className="px-4 py-3 text-left"><SortHeader column="joined" label="Joined" /></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((user) => {
                    const metrics = getMetrics(user)
                    const userPurchaseCount = purchaseCount(user)
                    const confirmedClasses = metrics.confirmedClassBookings + metrics.completedClassBookings

                    return (
                      <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-4 align-middle">
                          <div className="flex min-w-72 items-center gap-3">
                            {user.image ? (
                              <img src={user.image} alt="" className="h-10 w-10 rounded-full" />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                <span className="text-sm font-semibold text-primary">
                                  {user.name?.[0] || user.email[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="max-w-56 truncate font-medium text-foreground">
                                  {user.name || "Unnamed"}
                                </h3>
                                {user.role !== "USER" && (
                                  <Shield className="h-4 w-4 text-primary" />
                                )}
                                {user.authProvider && (
                                  <Badge variant="outline" className="capitalize">
                                    {user.authProvider}
                                  </Badge>
                                )}
                                {user.hasSupabaseAuth === false && (
                                  <Badge variant="secondary">Local only</Badge>
                                )}
                                {user.hasLocalUser === false && (
                                  <Badge variant="secondary">Auth only</Badge>
                                )}
                              </div>
                              <p className="mt-1 max-w-72 truncate text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <div className="flex items-center gap-2">
                            <Select
                              value={user.role}
                              onValueChange={(val) => updateRole(user.id, val as AppRole)}
                              disabled={!canEditRoles || user.hasLocalUser === false}
                            >
                              <SelectTrigger className="h-9 w-40 bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {appRoles.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    <span className="flex w-full items-center justify-between gap-3">
                                      <span>{roleLabels[role]}</span>
                                      <RoleAccessTooltip role={role} />
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <RoleAccessTooltip role={(appRoles.includes(user.role as AppRole) ? user.role : "USER") as AppRole} />
                          </div>
                          {user.hasLocalUser === false && (
                            <p className="mt-1 text-xs text-muted-foreground">Sync needed</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 align-middle text-muted-foreground">
                          {formatDateTime(user.lastSignInAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 align-middle text-muted-foreground">
                          {formatDateTime(metrics.lastActivityAt)}
                        </td>
                        <td className="px-4 py-4 text-right align-middle font-medium tabular-nums">
                          {formatNumber(metrics.pageViews)}
                        </td>
                        <td className="px-4 py-4 text-right align-middle font-medium tabular-nums">
                          {formatNumber(metrics.productViews)}
                        </td>
                        <td className="px-4 py-4 text-right align-middle tabular-nums">
                          <p className="font-medium">{formatNumber(metrics.checkoutViews)}</p>
                          <p className="text-xs text-muted-foreground">{formatNumber(metrics.checkoutIntentClicks)} starts</p>
                        </td>
                        <td className="px-4 py-4 text-right align-middle tabular-nums">
                          <p className="font-medium">{formatNumber(metrics.paymentIntentClicks)}</p>
                          <p className="text-xs text-muted-foreground">{formatNumber(metrics.paymentSessionsCreated)} sessions</p>
                        </td>
                        <td className="px-4 py-4 text-right align-middle tabular-nums">
                          <p className="font-medium">{formatNumber(metrics.checkoutAbandoned)}</p>
                          <p className="text-xs text-muted-foreground">{formatNumber(metrics.paymentStartFailed)} failed</p>
                        </td>
                        <td className="px-4 py-4 text-right align-middle tabular-nums">
                          <p className="font-medium">{formatNumber(userPurchaseCount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatNumber(confirmedClasses)} classes · {formatNumber(user._count.orders)} orders · {formatNumber(metrics.posReceiptPurchases)} POS
                          </p>
                          {metrics.posReceiptSpend > 0 && (
                            <p className="text-xs text-muted-foreground">{formatCurrency(metrics.posReceiptSpend)}</p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right align-middle tabular-nums">
                          <p className="font-medium">{formatNumber(user._count.posSales)}</p>
                          <p className="text-xs text-muted-foreground">as cashier</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 align-middle text-muted-foreground">
                          {formatDate(user.authCreatedAt || user.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
