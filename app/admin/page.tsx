<<<<<<< HEAD
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminApp from '@/components/AdminApp'

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <AdminApp user={session} />
}
=======
// app/admin/page.tsx
'use client'
import { useEffect, useState } from 'react'
import AdminApp from '@/components/AdminApp'

interface User { name: string; role: string }

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          if (!['super_admin', 'bookkeeper'].includes(d.user.role)) {
            window.location.href = '/'
            return
          }
          setUser(d.user)
        } else {
          window.location.href = '/login'
        }
      })
      .catch(() => { window.location.href = '/login' })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f1efec', fontFamily: 'Golos Text, system-ui, sans-serif', color: '#9d9690', fontSize: 14 }}>
      Загрузка...
    </div>
  )

  if (!user) return null

  return <AdminApp userName={user.name} userRole={user.role} />
}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
