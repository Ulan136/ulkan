import { NextRequest, NextResponse } from 'next/server'

// Динамический манифест: start_url = раздел, откуда ставят PWA (передаётся ?start).
// Нужно, чтобы иконка логиста/филиала/клиента открывала ИМЕННО его портал
// (на Android/Desktop манифестный start_url решает; iOS и так берёт текущий URL).
// Статичный public/manifest.json (start_url ".") — дефолт/фолбэк.

const ICONS = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
  { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
]

export function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('start') || '/'
  // Только безопасный внутренний путь (свой сайт), иначе — корень.
  const start = /^\/[A-Za-z0-9\-_/.]*$/.test(raw) ? raw : '/'
  return NextResponse.json(
    {
      name: 'U-Kan',
      short_name: 'U-Kan',
      description: 'Система управления заказами',
      start_url: start,
      scope: '/',
      display: 'standalone',
      background_color: '#f1efec',
      theme_color: '#211f1c',
      orientation: 'portrait-primary',
      icons: ICONS,
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  )
}
