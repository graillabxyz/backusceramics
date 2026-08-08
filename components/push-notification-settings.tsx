"use client"

import { useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Bell, BellOff, Clock3, Loader2, Volume2, VolumeX } from "lucide-react"
import { formatMinutesAsTime } from "@/lib/store-hours"
import { useAuth } from "@/lib/auth-context"

type NotificationPreference = {
  browserPushEnabled: boolean
  classBookingNotifications: boolean
  salesNotifications: boolean
  websiteVisitNotifications: boolean
  morningBriefingEnabled: boolean
  morningBriefingSoundEnabled: boolean
  liveAlertSoundEnabled: boolean
  afterHoursPushEnabled: boolean
  openingTimeMinutes: number
  closingTimeMinutes: number
}

type PushSettingsResponse = {
  configured: boolean
  publicKey: string
  preference: NotificationPreference
  subscriptions: { id: string; endpoint: string }[]
}

const defaultPreference: NotificationPreference = {
  browserPushEnabled: false,
  classBookingNotifications: true,
  salesNotifications: true,
  websiteVisitNotifications: false,
  morningBriefingEnabled: true,
  morningBriefingSoundEnabled: true,
  liveAlertSoundEnabled: true,
  afterHoursPushEnabled: false,
  openingTimeMinutes: 510,
  closingTimeMinutes: 1020,
}

function minutesToInput(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

function inputToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number)
  return hour * 60 + minute
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index)
  }

  return outputArray
}

function supportsBrowserPush() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  )
}

function isStaffRole(role?: string | null) {
  return role === "OWNER" || role === "ADMIN" || role === "MANAGER" || role === "POS_OPERATOR"
}

export function PushNotificationSettings() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [publicKey, setPublicKey] = useState("")
  const [preference, setPreference] = useState<NotificationPreference>(defaultPreference)
  const [deviceCount, setDeviceCount] = useState(0)
  const [currentDeviceEndpoint, setCurrentDeviceEndpoint] = useState("")
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const browserSupported = useMemo(supportsBrowserPush, [])
  const staff = isStaffRole(user?.role)

  useEffect(() => {
    if (browserSupported) {
      setPermission(Notification.permission)
    }

    async function loadSettings() {
      setLoading(true)
      try {
        const res = await fetch("/api/push-notifications")
        if (!res.ok) throw new Error("Could not load notification settings")
        const data = await res.json() as PushSettingsResponse
        setConfigured(data.configured)
        setPublicKey(data.publicKey || "")
        setPreference(data.preference || defaultPreference)
        setDeviceCount(data.subscriptions?.length || 0)

        if (browserSupported) {
          const registration = await navigator.serviceWorker.getRegistration()
          const subscription = await registration?.pushManager.getSubscription()
          const endpoint = subscription?.endpoint || ""
          const savedHere = data.subscriptions?.some((item) => item.endpoint === endpoint)
          setCurrentDeviceEndpoint(savedHere ? endpoint : "")
        }
      } catch (loadError) {
        console.error("Push notification settings load failed", loadError)
        setError("Could not load notification settings.")
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [browserSupported])

  async function savePreference(update: Partial<NotificationPreference>) {
    setSaving(true)
    setError("")
    setMessage("")

    try {
      const res = await fetch("/api/push-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not save notification settings")
      setPreference(data.preference)
      setMessage("Notification settings saved.")
    } catch (saveError) {
      console.error("Push notification preference save failed", saveError)
      setError(saveError instanceof Error ? saveError.message : "Could not save notification settings.")
    } finally {
      setSaving(false)
    }
  }

  async function enablePushForDevice() {
    setSaving(true)
    setError("")
    setMessage("")

    try {
      if (!browserSupported) {
        throw new Error("This browser does not support push notifications.")
      }
      if (!configured || !publicKey) {
        throw new Error("Push notifications are not configured for this site yet.")
      }

      let nextPermission = Notification.permission
      if (nextPermission === "default") {
        nextPermission = await Notification.requestPermission()
      }
      setPermission(nextPermission)

      if (nextPermission !== "granted") {
        throw new Error("Notifications are blocked for this browser.")
      }

      const registration = await navigator.serviceWorker.register("/push-worker.js")
      const existingSubscription = await registration.pushManager.getSubscription()
      const subscription = existingSubscription || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const res = await fetch("/api/push-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not enable push notifications")

      setPreference(data.preference)
      setCurrentDeviceEndpoint(subscription.endpoint)
      setDeviceCount((count) => Math.max(1, count))
      setMessage("This device will now receive Backus notifications.")
    } catch (enableError) {
      console.error("Push notification enable failed", enableError)
      setError(enableError instanceof Error ? enableError.message : "Could not enable push notifications.")
    } finally {
      setSaving(false)
    }
  }

  async function disablePushForDevice() {
    setSaving(true)
    setError("")
    setMessage("")

    try {
      let endpoint = ""
      if (browserSupported) {
        const registration = await navigator.serviceWorker.getRegistration()
        const subscription = await registration?.pushManager.getSubscription()
        endpoint = subscription?.endpoint || ""
        await subscription?.unsubscribe()
      }

      const res = await fetch("/api/push-notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not disable push notifications")

      setPreference(data.preference)
      setCurrentDeviceEndpoint("")
      setDeviceCount(endpoint ? Math.max(0, deviceCount - 1) : 0)
      setMessage("Push notifications are off for this device.")
    } catch (disableError) {
      console.error("Push notification disable failed", disableError)
      setError(disableError instanceof Error ? disableError.message : "Could not disable push notifications.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading notification settings...
        </CardContent>
      </Card>
    )
  }

  const pushActive = preference.browserPushEnabled && permission !== "denied" && Boolean(currentDeviceEndpoint)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="font-heading font-bold text-lg">Notification Settings</CardTitle>
            <CardDescription>Choose which Backus updates can reach this browser or device.</CardDescription>
          </div>
          <Badge variant={pushActive ? "secondary" : "outline"} className="w-fit">
            {pushActive ? "Device enabled" : "Device off"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!configured && (
          <Alert>
            <BellOff className="h-4 w-4" />
            <AlertTitle>Push keys are not configured yet</AlertTitle>
            <AlertDescription>
              Add the Web Push VAPID environment variables in Vercel before devices can subscribe.
            </AlertDescription>
          </Alert>
        )}

        {!browserSupported && (
          <Alert>
            <BellOff className="h-4 w-4" />
            <AlertTitle>This browser cannot receive push notifications</AlertTitle>
            <AlertDescription>
              Try Safari, Chrome, or another modern browser with notification support enabled.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Notification settings could not be updated</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {message && (
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertTitle>Saved</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">Push notifications on this device</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {permission === "denied"
                ? "Notifications are blocked in this browser's site settings."
                : `${deviceCount} active ${deviceCount === 1 ? "device" : "devices"} for your account.`}
            </p>
          </div>
          {pushActive ? (
            <Button variant="outline" onClick={disablePushForDevice} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Turn Off
            </Button>
          ) : (
            <Button onClick={enablePushForDevice} disabled={saving || !configured || !browserSupported || permission === "denied"}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enable Device
            </Button>
          )}
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <p className="font-medium text-foreground">Alert types</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the operational events that should reach this account on enabled devices.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-foreground">Class bookings</p>
              <p className="text-sm text-muted-foreground">New paid class bookings and confirmed seats.</p>
            </div>
            <Switch
              checked={preference.classBookingNotifications}
              disabled={saving}
              onCheckedChange={(checked) => savePreference({ classBookingNotifications: checked })}
              aria-label="Class booking push notifications"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-foreground">Sales and cups</p>
              <p className="text-sm text-muted-foreground">Cup sales, POS payments, and online POS payments.</p>
            </div>
            <Switch
              checked={preference.salesNotifications}
              disabled={saving}
              onCheckedChange={(checked) => savePreference({ salesNotifications: checked })}
              aria-label="Sales push notifications"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">Website visits</p>
                <Badge variant="outline">Quiet by default</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Visitor alerts can be noisy, so only enable this if you want live traffic pings.</p>
            </div>
            <Switch
              checked={preference.websiteVisitNotifications}
              disabled={saving || !staff}
              onCheckedChange={(checked) => savePreference({ websiteVisitNotifications: checked })}
              aria-label="Website visit push notifications"
            />
          </div>
        </div>

        <div className="space-y-5 rounded-lg border p-4">
          <div>
            <p className="font-medium text-foreground">POS timing and sound</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bali store hours determine whether alerts arrive immediately or wait for the next POS briefing.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-foreground">
              Opening time
              <input
                type="time"
                value={minutesToInput(preference.openingTimeMinutes)}
                onChange={(event) => savePreference({ openingTimeMinutes: inputToMinutes(event.target.value) })}
                disabled={saving}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-foreground">
              Closing time
              <input
                type="time"
                value={minutesToInput(preference.closingTimeMinutes)}
                onChange={(event) => savePreference({ closingTimeMinutes: inputToMinutes(event.target.value) })}
                disabled={saving}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            Current window: {formatMinutesAsTime(preference.openingTimeMinutes)} to {formatMinutesAsTime(preference.closingTimeMinutes)}, Bali time.
          </p>

          {[
            {
              key: "morningBriefingEnabled" as const,
              title: "Opening briefing",
              description: "Show today's confirmed classes, overnight sales, and online orders when the POS opens.",
            },
            {
              key: "morningBriefingSoundEnabled" as const,
              title: "Opening briefing sound",
              description: "Play a short chime when the briefing contains work for today.",
            },
            {
              key: "liveAlertSoundEnabled" as const,
              title: "Live in-app alert sound",
              description: "Play a chime for new booking and sale alerts while the admin or POS is open.",
            },
            {
              key: "afterHoursPushEnabled" as const,
              title: "Immediate after-hours push",
              description: "Send device push immediately while closed. Leave off to collect activity in the next opening briefing.",
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 font-medium text-foreground">
                  {item.key.includes("Sound") ? (preference[item.key] ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />) : null}
                  {item.title}
                </p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={preference[item.key]}
                disabled={saving || (item.key === "morningBriefingSoundEnabled" && !preference.morningBriefingEnabled)}
                onCheckedChange={(checked) => savePreference({ [item.key]: checked })}
                aria-label={item.title}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
