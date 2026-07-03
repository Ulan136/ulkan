'use client'
import { useState } from 'react'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [text, setText] = useState('')
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ cardId?: string; trackingUrl?: string; clientUrl?: string }>({})

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 16px', border: '1.5px solid #e0dbd3',
    borderRadius: 10, fontSize: 15, background: '#fff', outline: 'none',
    fontFamily: 'inherit', color: '#26231f', boxSizing: 'border-box',
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Ошибка'); return }

      // Если есть текст заявки — создаём заказ
      if (text.trim()) {
        const r2 = await fetch('/api/client/orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        const d2 = await r2.json()
        setResult({ cardId: d2.order?.id, trackingUrl: d2.trackingUrl, clientUrl: data.clientUrl })
      } else {
        setResult({ clientUrl: data.clientUrl })
      }
      setStep('done')
    } catch { setErr('Нет соединения') }
    finally { setLoading(false) }
  }

  const inp2: React.CSSProperties = { ...inp, resize: 'vertical', minHeight: 100 }

  if (step === 'done') return (
    <div style={{ minHeight: '100vh', background: '#f1efec', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16, padding: '40px 32px', border: '1px solid #e8e3db', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#211f1c', margin: '0 0 12px' }}>Заявка принята!</h2>
        <p style={{ color: '#6b655b', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Мы свяжемся с вами в ближайшее время. Отслеживайте статус заказа по ссылке ниже.
        </p>
        {result.cardId && (
          <div style={{ background: '#f1efec', borderRadius: 10, padding: '16px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#9d9690', marginBottom: 4 }}>Номер заявки</div>
            <div style={{ fontWeight: 700, fontSize: 18, fontFamily: 'JetBrains Mono, monospace', color: '#d4613a' }}>{result.cardId}</div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {result.trackingUrl && (
            <a href={result.trackingUrl} style={{ padding: '13px', background: '#d4613a', color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              Отследить заказ
            </a>
          )}
          {result.clientUrl && (
            <a href={result.clientUrl} style={{ padding: '13px', background: '#fff', color: '#26231f', borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: 'none', border: '1.5px solid #e0dbd3' }}>
              Мой кабинет
            </a>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f1efec', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, background: '#d4613a', borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>Ю</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#211f1c', margin: '0 0 4px' }}>Оставить заявку</h1>
          <p style={{ fontSize: 13, color: '#9d9690', margin: 0 }}>U-Kan · Логистика металлопроката</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', border: '1px solid #e8e3db' }}>
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 6 }}>Имя / Компания *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя или название компании" style={inp} required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 6 }}>Телефон *</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="+7 700 000 0000" style={inp} required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 6 }}>Email (необязательно)</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@company.kz" style={inp} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 6 }}>
                Текст заявки (необязательно)
              </label>
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Опишите что нужно: профнастил 50 листов, оцинковка..." style={inp2 as React.TextareaHTMLAttributes<HTMLTextAreaElement>['style']} />
            </div>
            {err && <div style={{ background: '#faeaea', color: '#b03020', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{err}</div>}
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: loading ? '#e0dbd3' : '#d4613a', color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 15, border: 'none', cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Отправляем...' : 'Отправить заявку'}
            </button>
          </form>
          <div style={{ marginTop: 18, textAlign: 'center' }}>
            <a href="/login" style={{ fontSize: 13, color: '#9d9690', textDecoration: 'none' }}>Я сотрудник → войти</a>
          </div>
        </div>
      </div>
    </div>
  )
}
