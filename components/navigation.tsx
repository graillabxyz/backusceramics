"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"

const navLinks = [
  { href: "/classes", label: "Classes" },
  { href: "/residency", label: "Residency" },
  { href: "/shop", label: "Shop" },
  { href: "/custom-orders", label: "Custom Orders" },
]

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const { isAuthenticated, user } = useAuth()

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
            
            {isAuthenticated ? (
              <Link href="/admin">
                <Button variant="outline" size="sm" className="ml-2 bg-transparent">
                  <User className="h-4 w-4 mr-2" />
                  {user?.name}
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm" className="ml-2 bg-transparent">
                  Login
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
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
              <div className="pt-4 border-t border-border">
                {isAuthenticated ? (
                  <Link href="/admin" onClick={() => setIsOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full bg-transparent">
                      <User className="h-4 w-4 mr-2" />
                      Admin Panel
                    </Button>
                  </Link>
                ) : (
                  <Link href="/login" onClick={() => setIsOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full bg-transparent">
                      Login
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
