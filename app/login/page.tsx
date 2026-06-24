'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const [mode, setMode] = useState<'email' | 'phone'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('+7')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || ''

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Ошибка входа'); return }
      redirect(data.user)
    } catch { setError('Ошибка сети') }
    finally { setLoading(false) }
  }

  async function handlePhone(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/phone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Пользователь не найден'); return }
      redirect(data.user)
    } catch { setError('Ошибка сети') }
    finally { setLoading(false) }
  }

  function redirect(user: any) {
    if (from) { router.push(from); return }
    if (user.role === 'logist') router.push(`/rsp/${user.slug}`)
    else if (user.role === 'warehouse_manager') router.push(`/warehouse/${user.slug}`)
    else if (user.role === 'client' || user.role === 'supplier_client') router.push(`/client/${user.slug}`)
    else router.push('/admin')
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1.5px solid #e6e2dc', background: '#fff', outline: 'none', fontFamily: 'inherit', color: '#26231f', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#8a847c', marginBottom: 4, display: 'block' }

  return (
    <div style={{ minHeight: '100vh', background: '#f1efec', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 380, background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>

        {/* Лого */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, background: '#d4613a', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>U</div>
          <span style={{ fontWeight: 700, fontSize: 18 }}>U-Kan</span>
        </div>

        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Вход в систему</div>
        <div style={{ color: '#8a847c', fontSize: 13, marginBottom: 20 }}>Выберите способ входа</div>

        {/* Переключатель */}
        <div style={{ display: 'flex', background: '#f1efec', borderRadius: 10, padding: 4, marginBottom: 20 }}>
          {[['email', '📧 Email + пароль'], ['phone', '📱 По телефону']].map(([m, l]) => (
            <button key={m} onClick={() => { setMode(m as any); setError('') }} style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#26231f' : '#8a847c', boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
              {l}
            </button>
          ))}
        </div>

        {error && <div style={{ background: '#faeaea', color: '#b03020', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>{error}</div>}

        {/* Email форма */}
        {mode === 'email' && (
          <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={lbl}>EMAIL</label><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@u-kan.kz" required /></div>
            <div><label style={lbl}>ПАРОЛЬ</label><input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></div>
            <button type="submit" disabled={loading} style={{ marginTop: 8, padding: '12px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Вход...' : 'ВОЙТИ →'}
            </button>
          </form>
        )}

        {/* Телефон форма */}
        {mode === 'phone' && (
          <form onSubmit={handlePhone} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={lbl}>ТЕЛЕФОН</label>
              <input style={inp} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 700 000 00 00" required />
              <div style={{ fontSize: 11, color: '#8a847c', marginTop: 4 }}>Для клиентов и логистов — телефон является паролем</div>
            </div>
            <button type="submit" disabled={loading} style={{ marginTop: 8, padding: '12px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Вход...' : 'ВОЙТИ ПО ТЕЛЕФОНУ →'}
            </button>
          </form>
        )}

        {/* Демо */}
        <div style={{ marginTop: 20, padding: 12, background: '#f1efec', borderRadius: 8, fontSize: 12, color: '#8a847c' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Демо доступ:</div>
          <div>admin@u-kan.kz / admin123</div>
          <div>buh@u-kan.kz / buh123</div>
          <div style={{ marginTop: 4, borderTop: '1px solid #e6e2dc', paddingTop: 4 }}>Логист: телефон из настроек</div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/register" style={{ color: '#8a847c', fontSize: 13 }}>Новый клиент? Зарегистрироваться →</a>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f1efec' }} />}>
      <LoginForm />
    </Suspense>
  )
}
