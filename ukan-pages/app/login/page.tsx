'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Ошибка входа'); return }
      router.push(data.redirect || '/admin')
    } catch { setErr('Нет соединения') }
    finally { setLoading(false) }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 16px', border: '1.5px solid #e0dbd3',
    borderRadius: 10, fontSize: 15, background: '#fff', outline: 'none',
    fontFamily: 'inherit', color: '#26231f', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1efec', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, background: '#d4613a', borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 22 }}>Ю</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#211f1c', margin: '0 0 4px', letterSpacing: '-0.3px' }}>U-Kan</h1>
          <p style={{ fontSize: 14, color: '#9d9690', margin: 0 }}>Вход для сотрудников</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', border: '1px solid #e8e3db' }}>
          <form onSubmit={handle}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 6 }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="admin@u-kan.kz" style={inp} required />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 6 }}>Пароль</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••" style={inp} required />
            </div>
            {err && <div style={{ background: '#faeaea', color: '#b03020', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{err}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: loading ? '#e0dbd3' : '#d4613a', color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 15, border: 'none', cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Входим...' : 'Войти'}
            </button>
          </form>
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #f1efec', textAlign: 'center' }}>
            <a href="/register" style={{ fontSize: 13, color: '#d4613a', textDecoration: 'none' }}>Я клиент — оставить заявку</a>
          </div>
        </div>
      </div>
    </div>
  )
}
