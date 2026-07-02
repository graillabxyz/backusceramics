"use client"

import Link from "next/link"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { canAccessAdmin, canUsePos } from "@/lib/permissions"
import { Menu, X, User, LogOut, LayoutDashboard, ShoppingBag, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

const navLinks = [
  { href: "/classes", label: "Classes" },
  { href: "/events", label: "Events" },
  { href: "/residency", label: "Residency" },
  { href: "/shop", label: "Shop" },
  { href: "/custom-orders", label: "Custom Orders" },
]

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { user, isAuthenticated, logout, openAuthModal } = useAuth()

  const isLoggedIn = isAuthenticated && user
  const isAdmin = canAccessAdmin(user?.role)
  const canOpenPos = canUsePos(user?.role)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
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
                    {user.name || user.email?.split("@")[0]}
                  </span>
                  {user.image ? (
                    <img
                      src={user.image}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-xs font-bold text-primary-foreground">
                        {(user.name || user.email || "U").charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-background rounded-xl border border-border shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-2.5 border-b border-border">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {user.name || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>

                    <div className="py-1">
                      <Link
                        href="/account"
                        className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                        My Orders
                      </Link>

                      <Link
                        href="/account/profile"
                        className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User className="w-4 h-4 text-muted-foreground" />
                        Profile
                      </Link>

                      {canOpenPos && (
                        <Link
                          href="/admin/pos"
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Store className="w-4 h-4 text-muted-foreground" />
                          POS Register
                        </Link>
                      )}

                      {isAdmin && (
                        <Link
                          href="/admin"
                          className="flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                          onClick={() => setUserMenuOpen(false)}
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
              <Link href="/account" className="flex items-center">
                {user.image ? (
                  <img src={user.image} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-foreground">
                      {(user.name || user.email || "U").charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              {/* Mobile auth links */}
              {isLoggedIn && (
                <>
                  <div className="border-t border-border pt-4 mt-2">
                    <Link
                      href="/account"
                      className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                      onClick={() => setIsOpen(false)}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      My Orders
                    </Link>
                    <Link
                      href="/account/profile"
                      className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                      onClick={() => setIsOpen(false)}
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                    {isAdmin && (
                      <>
                        {canOpenPos && (
                          <Link
                            href="/admin/pos"
                            className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                            onClick={() => setIsOpen(false)}
                          >
                            <Store className="w-4 h-4" />
                            POS Register
                          </Link>
                        )}
                      <Link
                        href="/admin"
                        className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                        onClick={() => setIsOpen(false)}
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        Admin Dashboard
                      </Link>
                      </>
                    )}
                    <button
                      onClick={() => { logout(); setIsOpen(false) }}
                      className="flex items-center gap-3 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors py-2 w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
