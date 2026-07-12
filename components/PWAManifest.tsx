'use client'
import { useEffect } from 'react'

// Подменяет <link rel="manifest"> на динамический манифест с start_url =
// текущий раздел, если пользователь в своём портале. Тогда установленная
// иконка открывает именно этот раздел (Android/Desktop). На лендинге/логине
// остаётся статичный public/manifest.json (start_url ".").
const PORTAL = /^\/(rsp|branch|client|warehouse|admin)(\/|$)/

export default function PWAManifest() {
  useEffect(() => {
    const path = window.location.pathname
    if (!PORTAL.test(path)) return
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.rel = 'manifest'
      document.head.appendChild(link)
    }
    link.href = `/api/pwa/manifest?start=${encodeURIComponent(path)}`
  }, [])
  return null
}
