// Custom service worker additions — merged into next-pwa's generated SW.
// Handles Web Push notifications and notification click routing.

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Fairshare", {
      body: data.body ?? "",
      icon: "/icon.png",
      badge: "/icon.png",
      data: { url: data.url ?? "/dashboard" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? "/dashboard"
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        const match = list.find((c) => c.url.includes(self.location.origin))
        return match ? match.focus() : clients.openWindow(targetUrl)
      })
  )
})
