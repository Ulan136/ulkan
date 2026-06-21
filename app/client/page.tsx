'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loginPhone } from '@/lib/api'

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^8/, '7').slice(0, 11)
  if (!digits) return ''
  let result = '+7'
  const rest = digits.startsWith('7') ? digits.slice(1) : digits
  if (rest.length > 0) result += ' ' + rest.slice(0, 3)
  if (rest.length > 3) result += ' ' + rest.slice(3, 6)
  if (rest.length > 6) result += ' ' + rest.slice(6, 8)
  if (rest.length > 8) result += ' ' + rest.slice(8, 10)
  return result
}

function ClientLoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await loginPhone(phone)
      const slug = data.slug || data.user?.slug
      if (!slug) throw new Error('Кабинет не найден')
      router.push(`/client/${slug}`)
    } catch {
      setError('Клиент с таким телефоном не найден. Зарегистрируйтесь на /register')
    } finally {
      setLoading(false)
    }
  }

  const hint = params.get('slug')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1efec', fontFamily: "'Golos Text', system-ui, sans-serif", padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 14, border: '1px solid #e6e2dc', padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#d4613a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff' }}>U</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>U-Kan · Кабинет заказчика</span>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Вход в кабинет</h1>
        <p style={{ fontSize: 13, color: '#8a847c', marginBottom: 20 }}>
          Введите телефон, который указали при регистрации
          {hint ? ` (${hint})` : ''}
        </p>

        {error && (
          <div style={{ background: '#faeaea', color: '#b03020', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b655b', marginBottom: 6 }}>Телефон</label>
          <input
            value={phone}
            onChange={e => setPhone(formatPhone(e.target.value))}
            placeholder="+7 ___ ___ __ __"
            required
            style={{ width: '100%', padding: '12px 14px', border: '1px solid #e0dcd5', borderRadius: 8, fontSize: 15, marginBottom: 20, fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          <button type="submit" disabled={loading}
            style={{ width: '100%', background: '#d4613a', color: '#fff', border: 'none', padding: '12px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Вход…' : 'ВОЙТИ В КАБИНЕТ →'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: '#8a847c', marginTop: 20, textAlign: 'center' }}>
          Нет аккаунта? <a href="/register" style={{ color: '#d4613a' }}>Зарегистрироваться</a>
        </p>
        <p style={{ fontSize: 12, color: '#8a847c', marginTop: 8, textAlign: 'center' }}>
          <a href="/" style={{ color: '#6b655b' }}>← На главную</a>
        </p>
      </div>
    </div>
  )
}

export default function ClientLoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Загрузка…</div>}>
      <ClientLoginForm />
    </Suspense>
  )
}