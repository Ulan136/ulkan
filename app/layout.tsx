import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'U-Kan — Система управления заказами',
  description: 'Логистика металла · Управление заказами',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
