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
  { href: "/account", label: "Dashboard", icon: ClipboardList, exact: true },
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

      <div className="flex-1 pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-6 rounded-lg border border-border bg-card p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Account</p>
            <h1 className="mt-2 font-heading font-bold text-2xl text-foreground sm:text-3xl">
              Welcome back, {user?.name?.split(" ")[0] || "there"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage bookings, profile details, and custom order progress.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            {/* Account Nav */}
            <nav className="flex gap-2 overflow-x-auto rounded-lg border border-border bg-card p-2 lg:sticky lg:top-24 lg:block lg:h-fit lg:space-y-1 lg:overflow-visible">
              {accountNav.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors lg:w-full lg:gap-3 lg:px-4 lg:py-3",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="h-4 w-4 lg:h-5 lg:w-5" />
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
