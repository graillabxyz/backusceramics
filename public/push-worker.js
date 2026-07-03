self.addEventListener("push", (event) => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {
      title: "Backus Ceramics",
      body: event.data ? event.data.text() : "You have a new notification.",
    }
  }

  const title = payload.title || "Backus Ceramics"
  const options = {
    body: payload.body || payload.message || "You have a new notification.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: payload.tag || payload.data?.notificationId || "backus-notification",
    data: payload.data || { url: payload.url || "/" },
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url === targetUrl) {
          return client.focus()
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }

      return undefined
    })
  )
})
