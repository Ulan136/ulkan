// U-Kan Service Worker — минимальный, для установки PWA
const CACHE_NAME = 'ukan-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim())
})

// Просто проксируем запросы — без агрессивного кеширования,
// т.к. данные должны быть всегда свежими (заказы, статусы)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})
