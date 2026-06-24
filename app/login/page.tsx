'use client'
<<<<<<< HEAD

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const ADMIN_ROLES = ['super_admin', 'bookkeeper', 'admin']
=======
import { useState } from 'react'
import { useRouter } from 'next/navigation'
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b

export default function LoginPage() {
  const router = useRouter()
<<<<<<< HEAD
  const params = useSearchParams()
  const from = params.get('from') || ''
  const reason = params.get('reason') || ''
  const roleHint = params.get('role') || ''

=======
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionRole, setSessionRole] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

<<<<<<< HEAD
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
=======
  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
<<<<<<< HEAD
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
=======
      if (!res.ok) { setErr(data.error || 'Ошибка входа'); return }
      router.push(data.redirect || '/admin')
    } catch { setErr('Нет соединения') }
    finally { setLoading(false) }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 16px', border: '1.5px solid #e0dbd3',
    borderRadius: 10, fontSize: 15, background: '#fff', outline: 'none',
    fontFamily: 'inherit', color: '#26231f', boxSizing: 'border-box',
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
  }

  const wrongRoleHint = reason === 'wrong_role' || (sessionRole && from === '/admin' && !ADMIN_ROLES.includes(sessionRole))

  return (
<<<<<<< HEAD
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1efec', fontFamily: "'Golos Text', system-ui, sans-serif", padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 14, border: '1px solid #e6e2dc', padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#d4613a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff' }}>U</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>U-Kan</span>
=======
    <div style={{ minHeight: '100vh', background: '#f1efec', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, background: '#d4613a', borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 22 }}>Ю</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#211f1c', margin: '0 0 4px', letterSpacing: '-0.3px' }}>U-Kan</h1>
          <p style={{ fontSize: 14, color: '#9d9690', margin: 0 }}>Вход для сотрудников</p>
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
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

<<<<<<< HEAD
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
=======
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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
      </div>
    </div>
  )
}
<<<<<<< HEAD

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Загрузка…</div>}>
      <LoginForm />
    </Suspense>
  )
}
=======
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
