// Минимальный SW: только для установки PWA + заготовка web-push.
// ⚠ НИКАКОГО кеширования — иначе пользователи застрянут на старой версии
// (грабля из METHOD.md). Все запросы идут в сеть (network-only).

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Network-only: никогда не отдаём из кеша.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  e.respondWith(fetch(e.request).catch(() => new Response('Offline', { status: 503 })))
})

// ── Web-push (заготовка на будущее) ──
self.addEventListener('push', e => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch (_) { data = { body: e.data && e.data.text() } }
  const title = data.title || 'U-Kan'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

// Клик по уведомлению — открыть URL из данных пуша (НЕ жёсткий раздел).
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.indexOf(url) !== -1 && 'focus' in c) return c.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
