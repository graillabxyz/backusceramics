"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import {
  ClipboardList,
  GraduationCap,
  User,
  Loader2,
} from "lucide-react"

const accountNav = [
  { href: "/account", label: "My Orders", icon: ClipboardList, exact: true },
  { href: "/account/bookings", label: "My Bookings", icon: GraduationCap },
  { href: "/account/profile", label: "Profile", icon: User },
]

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user, isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return (
      <main className="min-h-screen">
        <Navigation />
        <div className="pt-32 pb-16 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground mt-4">Loading your account...</p>
          </div>
        </div>
        <Footer />
      </main>
    )
  }

  if (!isAuthenticated) {
    return null // Middleware handles redirect
  }

  return (
    <main className="min-h-screen flex flex-col">
      <Navigation />

      <div className="flex-1 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-heading font-bold text-3xl text-foreground">
              Welcome back, {user?.name?.split(" ")[0] || "there"}
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your orders and bookings
            </p>
          </div>

          <div className="grid lg:grid-cols-[240px_1fr] gap-8">
            {/* Account Nav */}
            <nav className="space-y-1">
              {accountNav.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
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

            {/* Content */}
            <div className="min-w-0">
              {children}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  )
}
