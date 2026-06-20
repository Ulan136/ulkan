// app/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        const from = params.get('from') || '/admin'
        router.push(from)
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Ошибка входа')
      }
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f1efec', fontFamily: "'Golos Text', system-ui, sans-serif"
    }}>
      <div style={{
        width: 380, background: '#fff', borderRadius: 14,
        border: '1px solid #e6e2dc', padding: '36px 32px',
        boxShadow: '0 4px 24px rgba(0,0,0,.07)'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9,
            background: 'oklch(0.62 0.17 30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: '#fff', fontSize: 18
          }}>U</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-.2px' }}>U-Kan</div>
            <div style={{ fontSize: 10.5, color: '#8c857a', letterSpacing: '.3px' }}>ЛОГИСТИКА · АДМИН</div>
          </div>
        </div>

        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, letterSpacing: '-.3px' }}>
          Вход в систему
        </div>
        <div style={{ fontSize: 13, color: '#8a847c', marginBottom: 24 }}>
          Введите данные вашего аккаунта
        </div>

        {error && (
          <div style={{
            background: 'oklch(0.95 0.05 25)', border: '1px solid oklch(0.85 0.08 25)',
            color: 'oklch(0.48 0.16 25)', borderRadius: 8,
            padding: '10px 14px', fontSize: 13, marginBottom: 16
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#5a554d', marginBottom: 5 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@u-kan.kz"
              required
              style={{
                width: '100%', padding: '10px 13px', border: '1px solid #d8d3cc',
                borderRadius: 8, fontSize: 13, outline: 'none',
                fontFamily: 'inherit', background: '#faf8f6',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#5a554d', marginBottom: 5 }}>
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '10px 13px', border: '1px solid #d8d3cc',
                borderRadius: 8, fontSize: 13, outline: 'none',
                fontFamily: 'inherit', background: '#faf8f6',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px 0', marginTop: 4,
              background: loading ? '#c8a090' : 'oklch(0.62 0.17 30)',
              color: '#fff', border: 'none', borderRadius: 9,
              fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'background .15s'
            }}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: '12px 14px', background: '#f7f5f2', borderRadius: 8, fontSize: 12, color: '#8a847c' }}>
          <b>Демо:</b> admin@u-kan.kz / admin123
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
