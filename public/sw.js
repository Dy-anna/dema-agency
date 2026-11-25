// Service worker DEMA Agency : reçoit les notifications push et ouvre la bonne page au clic
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'DEMA Agency', body: event.data ? event.data.text() : '' } }
  const title = data.title || 'DEMA Agency'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const f of fenetres) {
      if (new URL(f.url).origin === self.location.origin) {
        await f.focus()
        if ('navigate' in f) return f.navigate(url)
        return
      }
    }
    return self.clients.openWindow(url)
  })())
})
