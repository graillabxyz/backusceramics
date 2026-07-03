"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users as UsersIcon, Loader2, Shield, AlertCircle } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { appRoles, canManageAdmins, roleLabels, type AppRole } from "@/lib/permissions"

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
  _count: {
    orders: number
    classBookings: number
    residencyApps: number
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

function formatDate(value?: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString()
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authSync, setAuthSync] = useState<UsersApiResponse["authSync"]>(undefined)
  const canEditRoles = canManageAdmins(currentUser?.role)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not load users")

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

  if (loading) {
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
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Visible users</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{users.length}</p>
        </div>
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Supabase auth users</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{authSync?.authUserCount ?? "—"}</p>
        </div>
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Backfilled this load</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{authSync?.createdFromAuth ?? 0}</p>
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
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {user.image ? (
                      <img src={user.image} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {user.name?.[0] || user.email[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground truncate">
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
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{user._count.orders} orders</span>
                        <span>{user._count.classBookings} bookings</span>
                        <span>{user._count.residencyApps} applications</span>
                        <span>· Joined {formatDate(user.authCreatedAt || user.createdAt)}</span>
                        {formatDate(user.lastSignInAt) && (
                          <span>Last sign-in {formatDate(user.lastSignInAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Select
                    value={user.role}
                    onValueChange={(val) => updateRole(user.id, val as AppRole)}
                    disabled={!canEditRoles || user.hasLocalUser === false}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {appRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabels[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
