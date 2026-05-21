"use client"

import { useEffect, useState } from "react"
import { Bell, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AdminNotification {
  id: string
  title: string
  message: string
  path?: string | null
  city?: string | null
  region?: string | null
  country?: string | null
  readAt?: string | null
  createdAt: string
}

function timeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.max(Math.floor(diffMs / 60000), 0)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function place(notification: AdminNotification) {
  return [notification.city, notification.region, notification.country].filter(Boolean).join(", ") || "Unknown location"
}

export function AdminNotifications({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  async function loadNotifications() {
    if (!enabled) return
    try {
      const res = await fetch("/api/admin/notifications")
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {
      // Notification polling should never interrupt admin work.
    }
  }

  useEffect(() => {
    loadNotifications()
    if (!enabled) return
    const interval = window.setInterval(loadNotifications, 30000)
    return () => window.clearInterval(interval)
  }, [enabled])

  async function markAllRead() {
    setUnreadCount(0)
    setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })))
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => undefined)
  }

  if (!enabled) return null

  return (
    <div className="relative">
      <Button variant="outline" size="icon" onClick={() => setOpen((value) => !value)} aria-label="Admin notifications">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-background shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <p className="text-xs text-muted-foreground">Recent website visits</p>
            </div>
            <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
              Mark read
            </Button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No visit notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "border-b border-border px-4 py-3 last:border-b-0",
                    !notification.readAt && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(notification.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{notification.message}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {place(notification)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
