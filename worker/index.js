// Custom service worker additions — merged into next-pwa's generated SW.
// Handles Web Push notifications and notification click routing.

self.addEventListener("push", (event) => {
  let data = {}
  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      // Payload wasn't JSON — treat the raw text as the title.
      data = { title: event.data.text() }
    }
  }
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
  const targetUrl = new URL(
    event.notification.data?.url ?? "/dashboard",
    self.location.origin
  ).href

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // If the exact target URL is already open, just focus it.
        const exact = windowClients.find((c) => c.url === targetUrl)
        if (exact) return exact.focus()
        // If any app window is open, navigate it to the target URL.
        const any = windowClients[0]
        if (any) return any.navigate(targetUrl).then((c) => c?.focus())
        // No window open — open a new one.
        return clients.openWindow(targetUrl)
      })
  )
})
