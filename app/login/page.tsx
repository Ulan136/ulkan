'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const ADMIN_ROLES = ['super_admin', 'bookkeeper', 'admin']

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from') || ''
  const reason = params.get('reason') || ''
  const roleHint = params.get('role') || ''

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionRole, setSessionRole] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (!user) return
        setSessionRole(user.role)
        if (from === '/admin' && ADMIN_ROLES.includes(user.role)) {
          router.replace('/admin')
        }
      })
      .finally(() => setCheckingSession(false))
  }, [from, router])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setSessionRole(null)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка входа')

      if (from.startsWith('/rsp/') && data.user.role === 'logist' && data.user.slug) {
        router.push(`/rsp/${data.user.slug}`)
      } else if (from === '/admin' && ADMIN_ROLES.includes(data.user.role)) {
        router.push('/admin')
      } else if (data.user.role === 'logist' && data.user.slug) {
        router.push(`/rsp/${data.user.slug}`)
      } else if (data.user.role === 'logist' && !data.user.slug) {
        throw new Error('У логиста не задан slug. Обратитесь к администратору.')
      } else if (['client', 'supplier_client'].includes(data.user.role) && data.user.slug) {
        router.push(`/client/${data.user.slug}`)
      } else {
        router.push('/admin')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const wrongRoleHint = reason === 'wrong_role' || (sessionRole && from === '/admin' && !ADMIN_ROLES.includes(sessionRole))

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1efec', fontFamily: "'Golos Text', system-ui, sans-serif", padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 14, border: '1px solid #e6e2dc', padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#d4613a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff' }}>U</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>U-Kan</span>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>
          {from === '/admin' ? 'Вход в админку' : roleHint === 'logist' || from.startsWith('/rsp/') ? 'Вход логиста' : 'Вход в систему'}
        </h1>
        <p style={{ fontSize: 13, color: '#8a847c', marginBottom: 24 }}>
          {from === '/admin'
            ? 'Войдите по email и паролю администратора'
            : roleHint === 'logist' || from.startsWith('/rsp/')
              ? 'Email и пароль логиста'
              : 'Введите данные вашего аккаунта'}
        </p>

        {checkingSession && (
          <div style={{ fontSize: 13, color: '#8a847c', marginBottom: 16 }}>Проверка сессии…</div>
        )}

        {wrongRoleHint && (
          <div style={{ background: '#fff8e6', color: '#8a5a10', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
            Сейчас вы вошли как <b>клиент/логист</b> (вход по телефону). Для админки нужен отдельный вход по email.
            <button type="button" onClick={handleLogout}
              style={{ display: 'block', marginTop: 10, background: '#211f1c', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>
              Выйти и войти в админку →
            </button>
          </div>
        )}

        {error && <div style={{ background: '#faeaea', color: '#b03020', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b655b', marginBottom: 6 }}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0dcd5', borderRadius: 8, fontSize: 14, marginBottom: 16, fontFamily: 'inherit', boxSizing: 'border-box' }} />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b655b', marginBottom: 6 }}>Пароль</label>
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" required
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0dcd5', borderRadius: 8, fontSize: 14, marginBottom: 20, fontFamily: 'inherit', boxSizing: 'border-box' }} />

          <button type="submit" disabled={loading}
            style={{ width: '100%', background: '#d4613a', color: '#fff', border: 'none', padding: '12px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: '#a39c92', marginTop: 20, textAlign: 'center' }}>
          {roleHint === 'logist' || from.startsWith('/rsp/')
            ? 'Демо логист: logist1@u-kan.kz / admin123'
            : 'Демо админ: admin@u-kan.kz / admin123'}
        </p>
        <p style={{ fontSize: 12, color: '#8a847c', marginTop: 12, textAlign: 'center' }}>
          Кабинет заказчика: <a href="/client" style={{ color: '#d4613a' }}>вход по телефону</a>
          {' · '}
          <a href="/register" style={{ color: '#d4613a' }}>регистрация</a>
        </p>
        <p style={{ fontSize: 12, color: '#8a847c', marginTop: 8, textAlign: 'center' }}>
          <a href="/" style={{ color: '#6b655b' }}>← На главную</a>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Загрузка…</div>}>
      <LoginForm />
    </Suspense>
  )
}