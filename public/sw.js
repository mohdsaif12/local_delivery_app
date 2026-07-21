// Take over as soon as a new service worker is deployed, instead of waiting
// for every tab to close — so updates apply on the next launch.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Network-first for page navigations. Installed PWAs (especially on iOS) love
// to serve a stale cached app shell on relaunch, which pins old code. Forcing
// a fresh fetch of the HTML means new builds show up without reinstalling.
// A pass-through fetch handler is also part of Chrome's PWA install criteria.
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => fetch(req)))
  }
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: data.tag ?? 'order-update',
      vibrate: [300, 100, 300, 100, 400], // Vibration pattern triggers Android Heads-Up popup & sound
      renotify: true,                      // Force Android to re-alert (sound + pop-up) even if previous notification with same tag is showing
      requireInteraction: true,           // Keeps notification visible on screen until user interacts
      silent: false,
      timestamp: Date.now(),
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const url = event.notification.data?.url ?? '/'
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
