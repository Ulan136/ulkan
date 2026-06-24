<<<<<<< HEAD
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ClientApp from '@/components/ClientApp'

type Props = { params: Promise<{ slug: string }> }

export default async function ClientPage({ params }: Props) {
  const { slug } = await params
  const session = await getSession()
  if (!session) redirect(`/client?slug=${slug}`)
  if (!['client', 'supplier_client'].includes(session.role)) redirect('/')
  if (session.slug && session.slug !== slug) redirect(`/client/${session.slug}`)
  return <ClientApp user={session} />
}
=======
// app/client/[slug]/page.tsx
'use client'
import { useEffect, useState } from 'react'
import ClientApp from '@/components/ClientApp'
import { useParams } from 'next/navigation'

interface User { id: string; name: string; role: string; slug: string }

export default function ClientPage() {
  const params = useParams()
  const slug = params.slug as string
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState('')
  const [needAuth, setNeedAuth] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.user && d.user.slug === slug) {
          setUser(d.user)
        } else if (d.user && d.user.role === 'super_admin') {
          // Admins can view any client page
          setUser({ ...d.user, slug })
        } else {
          setNeedAuth(true)
        }
      })
      .catch(() => setNeedAuth(true))
      .finally(() => setLoading(false))
  }, [slug])

  const loginByPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    const r = await fetch('/api/auth/phone', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    const d = await r.json()
    if (!r.ok) { setErr(d.error || 'Ошибка'); return }
    if (d.user.slug !== slug) { setErr('Это не ваша страница'); return }
    setUser(d.user)
    setNeedAuth(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f1efec', fontFamily: 'Golos Text, system-ui, sans-serif', color: '#9d9690' }}>
      Загрузка...
    </div>
  )

  if (needAuth) return (
    <div style={{ minHeight: '100vh', background: '#f1efec', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Golos Text, system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, background: '#d4613a', borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>Ю</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#211f1c', margin: '0 0 4px' }}>Личный кабинет</h1>
          <p style={{ fontSize: 13, color: '#9d9690', margin: 0 }}>Введите телефон для входа</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 16, padding: '24px 20px', border: '1px solid #e8e3db' }}>
          <form onSubmit={loginByPhone}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 6 }}>Номер телефона</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="+7 700 000 0000" required
              style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #e0dbd3', borderRadius: 9, fontSize: 15, fontFamily: 'inherit', color: '#26231f', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
            {err && <div style={{ background: '#faeaea', color: '#b03020', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{err}</div>}
            <button type="submit" style={{ width: '100%', padding: '13px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
              Войти
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  if (!user) return null
  return <ClientApp userName={user.name} slug={slug} />
}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
