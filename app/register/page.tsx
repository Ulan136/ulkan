'use client'
import { useState } from 'react'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+7')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ slug: string; clientUrl: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email: email || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Ошибка регистрации'); return }
      setResult(data)
    } catch { setError('Ошибка сети') }
    finally { setLoading(false) }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
    border: '1.5px solid #e6e2dc', background: '#fff', outline: 'none', fontFamily: 'inherit',
  }

  if (result) return (
    <div style={{ minHeight: '100vh', background: '#f1efec', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 480, background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, background: '#e8f5ee', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>✓</div>
        <div style={{ fontWeight: 700, fontSize: 20, color: '#2e8a5e', marginBottom: 8 }}>Аккаунт создан!</div>
        <p style={{ color: '#8a847c', fontSize: 13, marginBottom: 20 }}>Войдите по ссылке вашего кабинета</p>
        <div style={{ background: '#f1efec', borderRadius: 8, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, fontSize: 13, wordBreak: 'break-all' }}>{result.clientUrl}</span>
          <button onClick={() => { navigator.clipboard.writeText(result.clientUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            style={{ padding: '6px 10px', border: 'none', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13, boxShadow: '0 0 0 1px #e6e2dc' }}>
            {copied ? '✓' : '📋'}
          </button>
        </div>
        <div style={{ color: '#8a847c', fontSize: 12, marginBottom: 20 }}>Войти по телефону: {phone}</div>
        <a href={result.clientUrl} style={{ display: 'block', padding: '12px', background: '#d4613a', color: '#fff', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>
          Войти в кабинет →
        </a>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f1efec', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 480, background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, background: '#d4613a', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>U</div>
          <span style={{ fontWeight: 700, fontSize: 18 }}>U-Kan</span>
        </div>

        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Регистрация в U-Kan</div>
        <div style={{ color: '#8a847c', fontSize: 13, marginBottom: 24 }}>Заполните форму — создадим ваш личный кабинет</div>

        {error && <div style={{ background: '#faeaea', color: '#b03020', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a847c', marginBottom: 4, display: 'block' }}>ФИО / НАЗВАНИЕ КОМПАНИИ *</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Нипа Алматы" required />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a847c', marginBottom: 4, display: 'block' }}>ТЕЛЕФОН * — он же пароль для входа</label>
            <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 700 000 00 00" required />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#8a847c', marginBottom: 4, display: 'block' }}>EMAIL (необязательно)</label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="mail@example.com" />
          </div>
          <button type="submit" disabled={loading} style={{
            marginTop: 8, padding: '12px', background: '#d4613a', color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}>
            {loading ? 'Создание...' : 'ЗАРЕГИСТРИРОВАТЬСЯ →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/login" style={{ color: '#8a847c', fontSize: 13 }}>Уже есть аккаунт? Войти →</a>
        </div>
      </div>
    </div>
  )
}
