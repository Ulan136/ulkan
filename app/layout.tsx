import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
<<<<<<< HEAD
  title: 'U-Kan · Логистика',
  description: 'Система управления заказами · Логистика металла',
=======
  title: 'U-Kan · Логистика металла',
  description: 'Система управления заказами U-Kan',
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}