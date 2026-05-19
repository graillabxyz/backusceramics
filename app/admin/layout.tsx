"use client"

import React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { canAccessAdmin, canUsePos, isFullAdminRole, roleLabels } from "@/lib/permissions"
import { 
  LayoutDashboard, 
  GraduationCap, 
  ShoppingBag, 
  Settings,
  Home,
  LogOut,
  Menu,
  X,
  Loader2,
  ClipboardList,
  Calendar,
  Users,
  BarChart3,
  Store,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, access: "admin" },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList, access: "admin" },
  { href: "/admin/bookings", label: "Class Bookings", icon: GraduationCap, access: "admin" },
  { href: "/admin/applications", label: "Residency Apps", icon: Calendar, access: "admin" },
  { href: "/admin/pos", label: "Point of Sale", icon: Store, access: "pos" },
  { href: "/admin/products", label: "Products", icon: ShoppingBag, access: "admin" },
  { href: "/admin/users", label: "Users", icon: Users, access: "admin" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, access: "admin" },
  { href: "/admin/settings", label: "Settings", icon: Settings, access: "admin" },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading, isAuthenticated, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  React.useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role === "POS_OPERATOR" && pathname !== "/admin/pos") {
      router.replace("/admin/pos")
    }
  }, [isAuthenticated, isLoading, pathname, router, user?.role])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground mt-4">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !canAccessAdmin(user?.role)) {
    return null // Middleware handles the redirect
  }

  if (user?.role === "POS_OPERATOR" && pathname !== "/admin/pos") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const visibleNavItems = navItems.filter((item) => {
    if (item.access === "pos") return canUsePos(user?.role)
    return isFullAdminRole(user?.role)
  })

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-primary-foreground font-heading font-bold text-sm font-semibold">B</span>
          </div>
          <span className="font-heading font-bold text-lg font-medium">Admin</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 bottom-0 w-64 bg-background border-r border-border z-40 transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-heading font-bold text-lg font-semibold">B</span>
            </div>
            <div>
              <span className="font-heading font-bold text-lg font-medium block">Backus</span>
              <span className="text-xs text-muted-foreground">Admin Panel</span>
            </div>
          </div>

          <nav className="space-y-1">
            {visibleNavItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-border">
          <div className="mb-4 px-3 py-2 flex items-center gap-3">
            {user?.image && (
              <img
                src={user.image}
                alt=""
                className="w-8 h-8 rounded-full"
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              <p className="text-xs text-muted-foreground truncate">
                {roleLabels[user?.role || "USER"]}
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Home className="h-5 w-5" />
            View Site
          </Link>
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:pl-64 pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
