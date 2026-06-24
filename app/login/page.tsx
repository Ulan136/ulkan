'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Ошибка входа'); return }
      const role = data.user.role
      if (role === 'logist') router.push(`/rsp/${data.user.slug}`)
      else if (role === 'client' || role === 'supplier_client') router.push(`/client/${data.user.slug}`)
      else router.push('/admin')
    } catch { setError('Ошибка сети') }
    finally { setLoading(false) }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
    border: '1.5px solid #e6e2dc', background: '#fff', outline: 'none',
    fontFamily: 'inherit', color: '#26231f',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1efec', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 380, background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, background: '#d4613a', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>U</div>
          <span style={{ fontWeight: 700, fontSize: 18 }}>U-Kan</span>
        </div>

        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Вход в систему</div>
        <div style={{ color: '#8a847c', fontSize: 13, marginBottom: 24 }}>Введите данные вашего аккаунта</div>

        {error && (
          <div style={{ background: '#faeaea', color: '#b03020', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a847c', marginBottom: 4, display: 'block' }}>EMAIL</label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@u-kan.kz" required />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a847c', marginBottom: 4, display: 'block' }}>ПАРОЛЬ</label>
            <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>

          <button type="submit" disabled={loading} style={{
            marginTop: 8, padding: '12px', background: loading ? '#c0532a' : '#d4613a', color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}>
            {loading ? 'Вход...' : 'Войти →'}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: 12, background: '#f1efec', borderRadius: 8, fontSize: 12, color: '#8a847c' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Демо доступ:</div>
          <div>admin@u-kan.kz / admin123</div>
          <div>buh@u-kan.kz / buh123</div>
        </div>
      </div>
    </div>
  )
}
