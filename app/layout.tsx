import React from "react"
import type { Metadata } from 'next'
import { Montserrat, Figtree, Fredericka_the_Great } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from "@/lib/auth-context"
import { AuthModal } from "@/components/auth-modal"
import { ThemeProvider } from "@/components/theme-provider"
import { VisitTracker } from "@/components/visit-tracker"
import './globals.css'

const montserrat = Montserrat({ 
  subsets: ["latin"],
  variable: "--font-montserrat"
});

const figtree = Figtree({ 
  subsets: ["latin"],
  variable: "--font-figtree"
});

const fredericka = Fredericka_the_Great({ 
  subsets: ["latin"],
  weight: "400",
  variable: "--font-fredericka"
});

export const metadata: Metadata = {
  title: 'Backus Ceramics | Bali Pottery Studio & Residency',
  description: 'Join our ceramics studio in Bali for residency programs, pottery classes, and handcrafted ceramic pieces. Learn the art of pottery from shaping to kiln firing.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${montserrat.variable} ${figtree.variable} ${fredericka.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <VisitTracker />
            {children}
            <AuthModal />
          </AuthProvider>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
