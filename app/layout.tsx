import React from "react"
import type { Metadata } from 'next'
import { Montserrat, Figtree, Fredericka_the_Great } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from "@/lib/auth-context"
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
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
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
    <html lang="en">
      <body className={`${montserrat.variable} ${figtree.variable} ${fredericka.variable} font-sans antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
