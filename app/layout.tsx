import type { Metadata, Viewport } from 'next'
import './globals.css'
import PWAManifest from '@/components/PWAManifest'

export const metadata: Metadata = {
  title: 'U-Kan — Система управления заказами',
  description: 'Логистика металла · Управление заказами',
}

// Next 15: цвет темы/вьюпорт — отдельным export viewport (не в metadata → без warning)
export const viewport: Viewport = {
  themeColor: '#211f1c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="manifest" href="/manifest.json" />
        {/* iOS без явного apple-touch-icon показывает скриншот вместо иконки */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="U-Kan" />
      </head>
      <body>
        <PWAManifest />
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function(){});
            });
          }
        `}} />
      </body>
    </html>
  )
}
