"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "@/lib/auth-context"
import { canAccessAdmin, canUsePos } from "@/lib/permissions"
import { Loader2, Menu, X, User, LogOut, LayoutDashboard, ShoppingBag, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

const navLinks = [
  { href: "/classes", label: "Classes" },
  { href: "/events", label: "Events" },
  { href: "/residency", label: "Residency" },
  { href: "/shop", label: "Our Shop" },
  { href: "/wall-of-cups", label: "Wall of Cups" },
  { href: "/custom-orders", label: "Custom Orders" },
]

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { user, supabaseUser, isAuthenticated, isLoading, logout, openAuthModal } = useAuth()

  const isLoggedIn = isAuthenticated || !!supabaseUser
  const isAdmin = canAccessAdmin(user?.role)
  const canOpenPos = canUsePos(user?.role)
  const displayEmail = user?.email || supabaseUser?.email || ""
  const displayName =
    user?.name ||
    supabaseUser?.user_metadata?.full_name ||
    supabaseUser?.user_metadata?.name ||
    displayEmail?.split("@")[0] ||
    "Account"
  const displayImage =
    user?.image ||
    supabaseUser?.user_metadata?.avatar_url ||
    supabaseUser?.user_metadata?.picture ||
    null
  const displayInitial = (displayName || displayEmail || "U").charAt(0).toUpperCase()
  const isResolvingProfile = isLoggedIn && isLoading && !user
  const closeUserMenus = () => {
    setUserMenuOpen(false)
    setIsOpen(false)
  }

  useEffect(() => {
    if ((!isOpen && !userMenuOpen) || typeof window === "undefined") return

    const mobileQuery = window.matchMedia("(max-width: 767px)")
    if (!mobileQuery.matches) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setUserMenuOpen(false)
      setIsOpen(false)
    }
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) return
      setUserMenuOpen(false)
      setIsOpen(false)
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", closeOnEscape)
    mobileQuery.addEventListener("change", closeAtDesktop)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", closeOnEscape)
      mobileQuery.removeEventListener("change", closeAtDesktop)
    }
  }, [isOpen, userMenuOpen])

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex flex-col items-start">
            <span className="font-heading font-black tracking-wider text-foreground uppercase leading-none text-xl">
              Backus
            </span>
            <span className="font-heading font-light tracking-[0.3em] text-foreground uppercase leading-tight text-xs">
              Ceramics
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}

            <ThemeToggle />

            {/* Auth Button */}
            {isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  onBlur={() => setTimeout(() => setUserMenuOpen(false), 150)}
                  className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-full border border-border hover:border-foreground/30 transition-colors bg-background"
                  aria-label="User menu"
                >
                  <span className="text-sm font-medium text-foreground max-w-[100px] truncate hidden lg:block">
                    {isResolvingProfile ? "Signing in..." : displayName}
                  </span>
                  {isResolvingProfile ? (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    </div>
                  ) : displayImage ? (
                    <img
                      src={displayImage}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-xs font-bold text-primary-foreground">
                        {displayInitial}
                      </span>
                    </div>
                  )}
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-background rounded-xl border border-border shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-2.5 border-b border-border">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {isResolvingProfile ? "Finishing sign in..." : displayName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {displayEmail || "Loading your account"}
                      </p>
                    </div>

                    <div className="py-1">
                      <Link
                        href="/account"
                        className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                        onClick={closeUserMenus}
                      >
                        <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                        My Orders
                      </Link>

                      <Link
                        href="/account/profile"
                        className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                        onClick={closeUserMenus}
                      >
                        <User className="w-4 h-4 text-muted-foreground" />
                        Profile
                      </Link>

                      {canOpenPos && (
                        <Link
                          href="/admin/pos"
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                          onClick={closeUserMenus}
                        >
                          <Store className="w-4 h-4 text-muted-foreground" />
                          POS Register
                        </Link>
                      )}

                      {isAdmin && (
                        <Link
                          href="/admin"
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                          onClick={closeUserMenus}
                        >
                          <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                          Admin Dashboard
                        </Link>
                      )}
                    </div>

                    <div className="border-t border-border pt-1">
                      <button
                        onClick={() => logout()}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-destructive hover:bg-muted transition-colors w-full text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full px-5 border-foreground/20 hover:bg-foreground hover:text-background transition-all duration-300"
                onClick={() => openAuthModal()}
              >
                Sign In
              </Button>
            )}
          </div>

          {/* Mobile: Auth + Menu */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            {!isLoggedIn && (
              <Button variant="outline" size="sm" className="rounded-full px-4 text-xs" onClick={() => openAuthModal()}>
                Sign In
              </Button>
            )}
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen((open) => !open)
                  setIsOpen(false)
                }}
                className="flex items-center"
                aria-label="User menu"
              >
                {isResolvingProfile ? (
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  </div>
                ) : displayImage ? (
                  <img src={displayImage} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-foreground">
                      {displayInitial}
                    </span>
                  </div>
                )}
              </button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsOpen(!isOpen)
                setUserMenuOpen(false)
              }}
              aria-label="Toggle menu"
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        </nav>
      </header>

      {typeof document !== "undefined" && isLoggedIn && userMenuOpen && createPortal(
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[1px] md:hidden"
            onClick={closeUserMenus}
            aria-label="Close user menu"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="User menu"
            className="fixed inset-x-3 top-[calc(5rem+env(safe-area-inset-top)+0.5rem)] z-[80] max-h-[calc(100dvh-6rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-xl border border-border bg-background py-1.5 shadow-2xl md:hidden"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {isResolvingProfile ? "Finishing sign in..." : displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {displayEmail || "Loading your account"}
                </p>
              </div>
              <button type="button" onClick={closeUserMenus} className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close user menu">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="py-1">
              <Link href="/account" className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted" onClick={closeUserMenus}>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                My Orders
              </Link>
              <Link href="/account/profile" className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted" onClick={closeUserMenus}>
                <User className="h-4 w-4 text-muted-foreground" />
                Profile
              </Link>
              {canOpenPos && (
                <Link href="/admin/pos" className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted" onClick={closeUserMenus}>
                  <Store className="h-4 w-4 text-muted-foreground" />
                  POS Register
                </Link>
              )}
              {isAdmin && (
                <Link href="/admin" className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted" onClick={closeUserMenus}>
                  <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                  Admin Dashboard
                </Link>
              )}
            </div>
            <div className="border-t border-border pt-1">
              <button
                onClick={() => {
                  closeUserMenus()
                  logout()
                }}
                className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-sm text-destructive transition-colors hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </section>
        </>,
        document.body
      )}

      {typeof document !== "undefined" && isOpen && createPortal(
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className="fixed inset-x-0 bottom-0 top-[calc(5rem+env(safe-area-inset-top))] z-[60] overflow-y-auto overscroll-contain border-t border-border bg-background px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl md:hidden"
        >
          <div className="mx-auto flex max-w-md flex-col gap-3">
            <div className="mb-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Menu</p>
              <p className="mt-1 text-sm text-muted-foreground">Book classes, browse the shop, and manage your account.</p>
            </div>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-14 items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-base font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
                onClick={() => setIsOpen(false)}
              >
                <span>{link.label}</span>
                <span className="text-sm text-muted-foreground">Open</span>
              </Link>
            ))}

            {isLoggedIn && (
              <div className="mt-2 border-t border-border pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Account</p>
                <Link href="/account" className="flex min-h-12 items-center gap-3 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted" onClick={() => setIsOpen(false)}>
                  <ShoppingBag className="w-4 h-4" />
                  My Orders
                </Link>
                <Link href="/account/profile" className="flex min-h-12 items-center gap-3 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted" onClick={() => setIsOpen(false)}>
                  <User className="w-4 h-4" />
                  Profile
                </Link>
                {canOpenPos && (
                  <Link href="/admin/pos" className="flex min-h-12 items-center gap-3 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted" onClick={closeUserMenus}>
                    <Store className="w-4 h-4" />
                    POS Register
                  </Link>
                )}
                {isAdmin && (
                  <Link href="/admin" className="flex min-h-12 items-center gap-3 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted" onClick={closeUserMenus}>
                    <LayoutDashboard className="w-4 h-4" />
                    Admin Dashboard
                  </Link>
                )}
                <button onClick={() => { logout(); setIsOpen(false) }} className="flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-muted">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </section>,
        document.body
      )}
    </>
  )
}
