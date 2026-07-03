"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { hasCheckoutPaymentStarted, trackAnalyticsEvent } from "@/lib/client-analytics"

const notificationCooldownMs = 30 * 60 * 1000

function getSearchValue(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) || undefined
}

function analyticsRouteKind(pathname: string) {
  if (pathname === "/") return "home"
  if (pathname === "/shop") return "shop"
  if (pathname.startsWith("/shop/")) return "product"
  if (pathname === "/classes/checkout") return "checkout"
  if (pathname.startsWith("/classes")) return "classes"
  if (pathname.startsWith("/residency")) return "residency"
  if (pathname.startsWith("/custom-orders")) return "custom-orders"
  if (pathname.startsWith("/events")) return "events"
  return "content"
}

export function VisitTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return
    const search = window.location.search.replace(/^\?/, "")
    const path = `${pathname}${search ? `?${search}` : ""}`
    const routeKind = analyticsRouteKind(pathname)
    const urlSearchParams = new URLSearchParams(search)

    trackAnalyticsEvent({
      type: "page_view",
      path,
      source: getSearchValue(urlSearchParams, "source"),
      workshopId: getSearchValue(urlSearchParams, "workshopId"),
      workshopTitle: getSearchValue(urlSearchParams, "title"),
      scheduleId: getSearchValue(urlSearchParams, "scheduleId"),
      value: Number(urlSearchParams.get("price") || 0) || null,
      metadata: {
        routeKind,
        paymentStatus: getSearchValue(urlSearchParams, "payment"),
        seats: Number(urlSearchParams.get("seats") || 0) || undefined,
        prepaid: urlSearchParams.get("prepaid") || undefined,
      },
    })

    if (pathname === "/classes/checkout") {
      trackAnalyticsEvent({
        type: "checkout_view",
        path,
        source: getSearchValue(urlSearchParams, "source"),
        workshopId: getSearchValue(urlSearchParams, "workshopId"),
        workshopTitle: getSearchValue(urlSearchParams, "title"),
        scheduleId: getSearchValue(urlSearchParams, "scheduleId"),
        value: Number(urlSearchParams.get("price") || 0) || null,
        metadata: {
          dateKey: getSearchValue(urlSearchParams, "dateKey"),
          dateLabel: getSearchValue(urlSearchParams, "dateLabel"),
          timeLabel: getSearchValue(urlSearchParams, "timeLabel"),
          seats: Number(urlSearchParams.get("seats") || 0) || undefined,
          maxSeats: Number(urlSearchParams.get("maxSeats") || 0) || undefined,
          prepaid: urlSearchParams.get("prepaid") || undefined,
          requiredMeetings: Number(urlSearchParams.get("requiredMeetings") || 0) || undefined,
        },
      })
    }

    const paymentStatus = urlSearchParams.get("payment")
    if (paymentStatus === "success") {
      trackAnalyticsEvent({
        type: "payment_return_success",
        path,
        source: getSearchValue(urlSearchParams, "source"),
        workshopId: getSearchValue(urlSearchParams, "workshopId"),
        metadata: { reference: getSearchValue(urlSearchParams, "reference") },
      })
    }

    if (paymentStatus === "cancelled") {
      trackAnalyticsEvent({
        type: "payment_return_cancelled",
        path,
        source: getSearchValue(urlSearchParams, "source"),
        workshopId: getSearchValue(urlSearchParams, "workshopId"),
      })
    }

    const key = `backus:last-visit-notification:${pathname}`
    const lastSentAt = Number(sessionStorage.getItem(key) || 0)
    if (Date.now() - lastSentAt >= notificationCooldownMs) {
      sessionStorage.setItem(key, String(Date.now()))
      const payload = JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        title: document.title || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      })

      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/visits", new Blob([payload], { type: "application/json" }))
      } else {
        fetch("/api/visits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => undefined)
      }
    }

    if (pathname !== "/classes/checkout") return

    const handleCheckoutExit = () => {
      if (hasCheckoutPaymentStarted(path)) return
      trackAnalyticsEvent({
        type: "checkout_abandoned",
        path,
        source: getSearchValue(urlSearchParams, "source"),
        workshopId: getSearchValue(urlSearchParams, "workshopId"),
        workshopTitle: getSearchValue(urlSearchParams, "title"),
        scheduleId: getSearchValue(urlSearchParams, "scheduleId"),
        value: Number(urlSearchParams.get("price") || 0) || null,
        metadata: {
          reason: "pagehide_before_payment_start",
          seats: Number(urlSearchParams.get("seats") || 0) || undefined,
        },
      }, { beacon: true })
    }

    window.addEventListener("pagehide", handleCheckoutExit)
    return () => window.removeEventListener("pagehide", handleCheckoutExit)
  }, [pathname])

  return null
}
