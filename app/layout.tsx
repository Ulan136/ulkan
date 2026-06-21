import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'U-Kan · Логистика',
  description: 'Система управления заказами · Логистика металла',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}