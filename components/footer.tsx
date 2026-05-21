import Link from "next/link"
import { Instagram, Mail, MapPin } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/40 text-foreground dark:bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex flex-col items-start mb-4">
              <span className="font-heading text-xl font-black tracking-wider uppercase leading-none">
                Backus
              </span>
              <span className="font-heading text-sm font-light tracking-[0.3em] uppercase leading-tight">
                Ceramics
              </span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
              A ceramics studio in Bali offering residency programs, pottery classes, 
              and handcrafted ceramic pieces. Learn the art of pottery from shaping to kiln firing.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-heading font-bold text-lg font-medium mb-4">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/residency" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Residency Programs
                </Link>
              </li>
              <li>
                <Link href="/shop" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Shop
                </Link>
              </li>
              <li>
                <Link href="/custom-orders" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Custom Orders
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  About
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading font-bold text-lg font-medium mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Canggu, Bali</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <a href="mailto:info@backusceramics.com" className="hover:text-foreground transition-colors">
                  info@backusceramics.com
                </a>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Instagram className="h-4 w-4" />
                <a href="https://instagram.com/backusceramics" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  @backusceramics
                </a>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                <a href="https://wa.me/6282145890402" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  +62 821-4589-0402
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {new Date().getFullYear()} Backus Ceramics. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/data-deletion" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Data Deletion
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
