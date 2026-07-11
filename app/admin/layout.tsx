"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Eye,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShoppingBag,
  Store,
  Users,
  X,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { canAccessAdmin, canUsePos, canViewAnalytics, isFullAdminRole, roleLabels } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { AdminNotifications } from "@/components/admin-notifications"

type NavAccess = "admin" | "pos" | "analytics"

const navSections = [
  {
    label: "Workspace",
    items: [
      { href: "/admin", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, exact: true, access: "admin" as NavAccess },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ClipboardList, access: "admin" as NavAccess },
      { href: "/admin/bookings", label: "Class Bookings", shortLabel: "Classes", icon: GraduationCap, access: "admin" as NavAccess },
      { href: "/admin/applications", label: "Residency Apps", icon: CalendarDays, access: "admin" as NavAccess },
      { href: "/admin/pos", label: "Point of Sale", shortLabel: "POS", icon: Store, access: "pos" as NavAccess },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: ShoppingBag, access: "admin" as NavAccess },
      { href: "/admin/wares", label: "Wall of Cups", icon: Eye, access: "admin" as NavAccess },
    ],
  },
  {
    label: "Insights & access",
    items: [
      { href: "/admin/users", label: "Users", icon: Users, access: "admin" as NavAccess },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3, access: "analytics" as NavAccess },
      { href: "/admin/settings", label: "Settings", icon: Settings, access: "admin" as NavAccess },
    ],
  },
]

type NavItem = (typeof navSections)[number]["items"][number]

function itemIsActive(pathname: string, item: NavItem) {
  return "exact" in item && item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function canSeeItem(access: NavAccess, role?: string | null) {
  if (access === "pos") return canUsePos(role)
  if (access === "analytics") return canViewAnalytics(role)
  return isFullAdminRole(role)
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, isLoading, isAuthenticated, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [posKioskMode, setPosKioskMode] = useState(false)
  const isPosRoute = pathname === "/admin/pos" || pathname.startsWith("/admin/pos/")
  const isProductsRoute = pathname === "/admin/products" || pathname.startsWith("/admin/products/")
  const isWaresRoute = pathname === "/admin/wares" || pathname.startsWith("/admin/wares/")
  const isPosKioskRoute = posKioskMode && (isPosRoute || isProductsRoute || isWaresRoute)

  const visibleSections = useMemo(() => navSections
    .map((section) => ({ ...section, items: section.items.filter((item) => canSeeItem(item.access, user?.role)) }))
    .filter((section) => section.items.length > 0), [user?.role])
  const visibleItems = visibleSections.flatMap((section) => section.items)
  const currentItem = visibleItems.find((item) => itemIsActive(pathname, item))
  const currentPageLabel = currentItem?.label || "Admin"
  const mobileItems = ["/admin", "/admin/bookings", "/admin/pos", "/admin/products"]
    .map((href) => visibleItems.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item))

  useEffect(() => {
    setSidebarOpen(false)
    setUserMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (typeof window === "undefined") return

    const syncKioskMode = () => {
      const params = new URLSearchParams(window.location.search)
      setPosKioskMode(params.get("posFullscreen") === "1" || window.localStorage.getItem("backus-pos-fullscreen") === "1")
    }

    syncKioskMode()
    window.addEventListener("storage", syncKioskMode)
    window.addEventListener("backus-pos-kiosk-change", syncKioskMode)
    return () => {
      window.removeEventListener("storage", syncKioskMode)
      window.removeEventListener("backus-pos-kiosk-change", syncKioskMode)
    }
  }, [pathname])

  useEffect(() => {
    if (!sidebarOpen || typeof document === "undefined") return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [sidebarOpen])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Opening workspace...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !canAccessAdmin(user?.role)) return null

  const displayName = user?.name || user?.email?.split("@")[0] || "Admin"
  const displayEmail = user?.email || ""
  const displayInitial = (displayName || displayEmail || "A").charAt(0).toUpperCase()

  const profileButton = (
    <button
      type="button"
      onClick={() => {
        setUserMenuOpen((open) => !open)
        setSidebarOpen(false)
      }}
      className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-background transition hover:bg-muted"
      aria-label="Admin profile menu"
      aria-expanded={userMenuOpen}
    >
      {user?.image ? <img src={user.image} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-semibold">{displayInitial}</span>}
    </button>
  )

  return (
    <div className="min-h-screen bg-muted/25">
      {!isPosKioskRoute && !isPosRoute && (
        <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">B</div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Backus</p>
              <p className="truncate text-sm font-semibold text-foreground">{currentPageLabel}</p>
            </div>
          </div>
          <div className="relative flex items-center gap-1.5">
            <AdminNotifications enabled={isFullAdminRole(user?.role)} />
            {profileButton}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSidebarOpen((open) => !open)
                setUserMenuOpen(false)
              }}
              aria-label="Open admin navigation"
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            {userMenuOpen && (
              <div className="absolute right-10 top-12 z-[70] w-64 overflow-hidden rounded-lg border border-border bg-background shadow-xl">
                <div className="border-b border-border px-4 py-3">
                  <p className="truncate text-sm font-semibold">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{roleLabels[user?.role || "USER"]}</p>
                </div>
                <Link href="/" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  View site
                </Link>
                <button onClick={() => logout()} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-destructive hover:bg-muted">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      <aside
        aria-label="Admin navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-[60] flex w-[280px] flex-col border-r border-border bg-background transition-transform lg:z-40 lg:w-60 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          isPosKioskRoute && "hidden"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5 lg:h-[72px] lg:border-b-0">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">B</div>
            <div>
              <span className="block text-base font-semibold leading-tight">Backus</span>
              <span className="text-xs text-muted-foreground">Studio operations</span>
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3 lg:py-1">
          {visibleSections.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = itemIsActive(pathname, item)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <div className="mb-2 flex items-center gap-3 rounded-md px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold">
              {user?.image ? <img src={user.image} alt="" className="h-full w-full object-cover" /> : displayInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabels[user?.role || "USER"]}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <Link href="/" className="flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <Home className="h-4 w-4" />
              Site
            </Link>
            <button onClick={() => logout()} className="flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && !isPosKioskRoute && <button className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

      <main className={cn(
        "min-h-screen lg:pl-60 lg:pt-0 lg:pb-0",
        isPosRoute ? "pt-0 pb-0" : "pt-16 pb-24",
        isPosKioskRoute && "p-0 lg:pl-0"
      )}>
        {!isPosKioskRoute && !isPosRoute && (
          <div className="sticky top-0 z-30 hidden h-14 items-center justify-between border-b border-border bg-background/90 px-6 backdrop-blur lg:flex">
            <div>
              <p className="text-sm font-semibold text-foreground">{currentPageLabel}</p>
            </div>
            <AdminNotifications enabled={isFullAdminRole(user?.role)} />
          </div>
        )}
        <div className={cn(isPosKioskRoute ? "p-0" : isPosRoute ? "p-2 sm:p-3 lg:p-4" : "p-4 sm:p-6 lg:p-7 xl:p-8")}>
          {children}
        </div>
      </main>

      {!isPosKioskRoute && !isPosRoute && mobileItems.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-background/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }} aria-label="Primary admin navigation">
          {mobileItems.map((item) => {
            const active = itemIsActive(pathname, item)
            return (
              <Link key={item.href} href={item.href} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                <item.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                <span className="max-w-full truncate">{"shortLabel" in item ? item.shortLabel : item.label}</span>
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
