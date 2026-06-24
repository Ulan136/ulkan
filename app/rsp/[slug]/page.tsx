<<<<<<< HEAD
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LogistPortal from '@/components/LogistPortal'

type Props = { params: Promise<{ slug: string }> }

export default async function RspPage({ params }: Props) {
  const session = await getSession()
  const { slug } = await params
  if (!session) redirect(`/login?from=/rsp/${slug}`)
  if (session.role !== 'logist') redirect('/')
  if (session.slug && session.slug !== slug) redirect(`/rsp/${session.slug}`)
  return <LogistPortal user={session} />
}
=======
// app/rsp/[slug]/page.tsx
'use client'
import { useEffect, useState } from 'react'
import LogistPortal from '@/components/LogistPortal'
import { useParams } from 'next/navigation'

interface User { id: string; name: string; role: string; slug: string }

export default function LogistPage() {
  const params = useParams()
  const slug = params.slug as string
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.user && (d.user.slug === slug || d.user.role === 'super_admin')) {
          setUser(d.user)
        } else {
          window.location.href = '/login?from=/rsp/' + slug
        }
      })
      .catch(() => { window.location.href = '/login' })
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f1efec', fontFamily: 'Golos Text, system-ui, sans-serif', color: '#9d9690' }}>
      Загрузка...
    </div>
  )

  if (!user) return null
  return <LogistPortal userName={user.name} userId={user.id} />
}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
