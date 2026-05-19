"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users as UsersIcon, Loader2, Shield } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { appRoles, canManageAdmins, roleLabels, type AppRole } from "@/lib/permissions"

interface UserData {
  id: string
  name: string | null
  email: string
  role: string
  image: string | null
  createdAt: string
  _count: {
    orders: number
    classBookings: number
    residencyApps: number
  }
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const canEditRoles = canManageAdmins(currentUser?.role)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users")
      if (res.ok) setUsers(await res.json())
    } catch (err) {
      console.error("Failed to fetch users:", err)
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
          Manage user accounts{canEditRoles ? " and roles" : ". Owner admin controls role changes."}
        </p>
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
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{user._count.orders} orders</span>
                        <span>{user._count.classBookings} bookings</span>
                        <span>{user._count.residencyApps} applications</span>
                        <span>· Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <Select
                    value={user.role}
                    onValueChange={(val) => updateRole(user.id, val as AppRole)}
                    disabled={!canEditRoles}
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
