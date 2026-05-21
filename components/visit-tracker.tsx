"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const notificationCooldownMs = 30 * 60 * 1000

export function VisitTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return

    const key = `backus:last-visit-notification:${pathname}`
    const lastSentAt = Number(sessionStorage.getItem(key) || 0)
    if (Date.now() - lastSentAt < notificationCooldownMs) return

    sessionStorage.setItem(key, String(Date.now()))
    const payload = JSON.stringify({
      path: pathname,
      referrer: document.referrer || null,
      title: document.title || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    })

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/visits", new Blob([payload], { type: "application/json" }))
      return
    }

    fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined)
  }, [pathname])

  return null
}
