'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ slug: string; clientUrl: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка')
      setSuccess({ slug: data.slug, clientUrl: data.clientUrl })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1efec', fontFamily: "'Golos Text', system-ui, sans-serif", padding: 20 }}>
        <div style={{ maxWidth: 420, background: '#fff', borderRadius: 14, border: '1px solid #e6e2dc', padding: 32, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e8f5ee', color: '#2e8a5e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 16px' }}>✓</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Аккаунт создан!</h2>
          <p style={{ fontSize: 13, color: '#8a847c', marginBottom: 16 }}>Ссылка кабинета:</p>
          <div style={{ background: '#faf8f6', padding: '10px 14px', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, marginBottom: 20, wordBreak: 'break-all' }}>{success.clientUrl}</div>
          <button onClick={() => router.push(`/client/${success.slug}`)}
            style={{ background: '#d4613a', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Войти в кабинет →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1efec', fontFamily: "'Golos Text', system-ui, sans-serif", padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 14, border: '1px solid #e6e2dc', padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Регистрация в U-Kan</h1>
        <p style={{ fontSize: 13, color: '#8a847c', marginBottom: 24 }}>Заполните форму — создадим ваш личный кабинет</p>

        {error && <div style={{ background: '#faeaea', color: '#b03020', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b655b', marginBottom: 6 }}>ФИО / Название компании *</label>
          <input value={name} onChange={e => setName(e.target.value)} required
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0dcd5', borderRadius: 8, fontSize: 14, marginBottom: 16, fontFamily: 'inherit', boxSizing: 'border-box' }} />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b655b', marginBottom: 6 }}>Телефон * (он же пароль для входа)</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+7 ___ ___ __ __"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0dcd5', borderRadius: 8, fontSize: 14, marginBottom: 16, fontFamily: 'inherit', boxSizing: 'border-box' }} />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b655b', marginBottom: 6 }}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0dcd5', borderRadius: 8, fontSize: 14, marginBottom: 20, fontFamily: 'inherit', boxSizing: 'border-box' }} />

          <button type="submit" disabled={loading}
            style={{ width: '100%', background: '#d4613a', color: '#fff', border: 'none', padding: '12px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Создание…' : 'ЗАРЕГИСТРИРОВАТЬСЯ →'}
          </button>
        </form>
      </div>
    </div>
  )
}