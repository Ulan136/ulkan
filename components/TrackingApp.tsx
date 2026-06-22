'use client'
import { useState } from 'react'

interface TrackData {
  id: string; from: string; to: string; status: string; stage: number
  progress: number; heroIcon: string; createdAt: string; delivered?: string
  positions: { name: string; qty: number; unit: string; status: string }[]
  history: { text: string; time: string }[]
  details: { k: string; v: string }[]
  showChange: boolean
}

const STAGES = ['Заявка', 'Принят', 'В работе', 'Отгрузка', 'Доставлено']

export default function TrackingApp() {
  const [tab, setTab] = useState<'track' | 'request'>('track')
  const [id, setId] = useState('')
  const [data, setData] = useState<TrackData | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  // Внешняя заявка
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [text, setText] = useState('')
  const [done, setDone] = useState<{ cardId: string; trackingUrl: string; clientUrl: string } | null>(null)

  // Изменение заказа
  const [showChange, setShowChange] = useState(false)
  const [changeText, setChangeText] = useState('')
  const [changePhone, setChangePhone] = useState('')
  const [changeSent, setChangeSent] = useState(false)

  const findOrder = async () => {
    if (!id.trim()) return
    setLoading(true); setErr(''); setData(null)
    try {
      const r = await fetch(`/api/track?id=${encodeURIComponent(id.trim())}`)
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'Заказ не найден'); return }
      setData(d)
    } catch { setErr('Ошибка соединения') }
    finally { setLoading(false) }
  }

  const submitRequest = async () => {
    if (!name || !phone || !text) { setErr('Заполните все поля'); return }
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/track/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, text }),
      })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'Ошибка'); return }
      setDone(d)
    } catch { setErr('Ошибка соединения') }
    finally { setLoading(false) }
  }

  const submitChange = async () => {
    if (!changeText || !changePhone || !data) return
    await fetch('/api/track/change', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: data.id, changeText, changePhone }),
    })
    setChangeSent(true); setShowChange(false)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '12px 16px', border: '1.5px solid #e0dbd3', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', color: '#26231f', outline: 'none', boxSizing: 'border-box', background: '#fff' }

  return (
    <div style={{ minHeight: '100vh', background: '#f1efec', fontFamily: 'Golos Text, system-ui, sans-serif' }}>
      {/* Шапка */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8e3db', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, background: '#d4613a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700 }}>Ю</span>
          </div>
          <span style={{ fontWeight: 700, color: '#211f1c', fontSize: 16 }}>U-Kan</span>
        </a>
      </div>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 16px' }}>
        {/* Табы */}
        <div style={{ display: 'flex', background: '#fff', borderRadius: 12, padding: 4, marginBottom: 24, border: '1px solid #e8e3db', maxWidth: 480 }}>
          {([{ k: 'track', label: '🔍 Отследить заказ' }, { k: 'request', label: '📋 Новая заявка' }] as const).map(t => (
            <button key={t.k} onClick={() => { setTab(t.k); setData(null); setErr(''); setDone(null) }} style={{
              flex: 1, padding: '11px 8px', border: 'none', borderRadius: 9, cursor: 'pointer',
              background: tab === t.k ? '#d4613a' : 'none', color: tab === t.k ? '#fff' : '#6b655b',
              fontWeight: tab === t.k ? 700 : 400, fontSize: 14, fontFamily: 'inherit',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ТРЕКИНГ */}
        {tab === 'track' && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #e8e3db', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={id} onChange={e => setId(e.target.value)} onKeyDown={e => e.key === 'Enter' && findOrder()}
                  placeholder="Введите номер заказа: C-001-100626" style={{ ...inp, flex: 1 }} />
                <button onClick={findOrder} disabled={loading} style={{ padding: '12px 20px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  {loading ? '...' : 'Найти'}
                </button>
              </div>
              {err && <div style={{ marginTop: 10, color: '#b03020', fontSize: 13 }}>{err}</div>}
            </div>

            {data && (
              <div style={{ animation: 'ukfade .25s ease' }}>
                {/* Герой */}
                <div style={{ background: '#fff', borderRadius: 14, padding: '24px 20px', border: '1px solid #e8e3db', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#9d9690', marginBottom: 4 }}>{data.id}</div>
                      <div style={{ fontSize: 28, marginBottom: 4 }}>{data.heroIcon}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#211f1c' }}>{data.status}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 32, fontWeight: 700, color: data.progress === 100 ? '#3a9d6e' : '#d4613a' }}>{data.progress}%</div>
                      <div style={{ fontSize: 12, color: '#9d9690' }}>готовности</div>
                    </div>
                  </div>

                  {/* Прогресс-бар */}
                  <div style={{ background: '#e8e3db', borderRadius: 6, height: 10, marginBottom: 12, overflow: 'hidden' }}>
                    <div style={{ width: `${data.progress}%`, height: '100%', background: data.progress === 100 ? '#3a9d6e' : '#d4613a', borderRadius: 6, transition: 'width .6s' }} />
                  </div>

                  {/* Этапы */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 8, left: 0, right: 0, height: 2, background: '#e8e3db', zIndex: 0 }} />
                    <div style={{ position: 'absolute', top: 8, left: 0, height: 2, background: '#d4613a', zIndex: 0, transition: 'width .6s', width: `${(data.stage - 1) / 4 * 100}%` }} />
                    {STAGES.map((s, i) => (
                      <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: i < data.stage ? '#d4613a' : '#fff', border: `2px solid ${i < data.stage ? '#d4613a' : '#e8e3db'}`, transition: 'all .3s' }} />
                        <div style={{ fontSize: 10, color: i < data.stage ? '#d4613a' : '#9d9690', marginTop: 4, fontWeight: i === data.stage - 1 ? 700 : 400, whiteSpace: 'nowrap' }}>{s}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Позиции */}
                {data.positions.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', border: '1px solid #e8e3db', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#9d9690', marginBottom: 10, textTransform: 'uppercase' }}>Позиции заказа</div>
                    {data.positions.map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < data.positions.length - 1 ? '1px solid #f1efec' : 'none', fontSize: 14 }}>
                        <span>{p.name} — {p.qty} {p.unit}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: p.status === 'Доставлено' ? '#2e8a5e' : '#9d9690' }}>{p.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Детали */}
                <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', border: '1px solid #e8e3db', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#9d9690', marginBottom: 10, textTransform: 'uppercase' }}>Детали</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {data.details.map(d => (
                      <div key={d.k}>
                        <div style={{ fontSize: 11, color: '#9d9690', marginBottom: 2 }}>{d.k}</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{d.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* История */}
                {data.history.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', border: '1px solid #e8e3db', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#9d9690', marginBottom: 10, textTransform: 'uppercase' }}>История</div>
                    {data.history.map((h, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10, paddingBottom: 10, borderBottom: i < data.history.length - 1 ? '1px solid #f1efec' : 'none' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d4613a', marginTop: 6, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{h.text}</div>
                          <div style={{ fontSize: 11, color: '#9d9690' }}>{h.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Изменить заказ */}
                {data.showChange && !changeSent && (
                  <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', border: '1px solid #e8e3db' }}>
                    {!showChange ? (
                      <button onClick={() => setShowChange(true)} style={{ width: '100%', padding: '12px', background: '#fff0ea', color: '#c0532a', border: '1px solid #f4c4a8', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                        ✏ Изменить заказ
                      </button>
                    ) : (
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Изменить заказ</div>
                        <textarea value={changeText} onChange={e => setChangeText(e.target.value)} rows={3} placeholder="Опишите изменения..."
                          style={{ ...inp, resize: 'none', marginBottom: 10 } as React.CSSProperties} />
                        <input value={changePhone} onChange={e => setChangePhone(e.target.value)} placeholder="Ваш телефон" style={{ ...inp, marginBottom: 12 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setShowChange(false)} style={{ flex: 1, padding: '11px', background: '#f1efec', border: 'none', borderRadius: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
                          <button onClick={submitChange} style={{ flex: 2, padding: '11px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Отправить</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {changeSent && <div style={{ background: '#e8f5ee', borderRadius: 10, padding: '14px 16px', color: '#2e8a5e', fontWeight: 600, fontSize: 14 }}>✓ Изменение отправлено менеджеру</div>}
              </div>
            )}
          </div>
        )}

        {/* ВНЕШНЯЯ ЗАЯВКА */}
        {tab === 'request' && (
          <div style={{ maxWidth: 540 }}>
            {done ? (
              <div style={{ background: '#fff', borderRadius: 14, padding: '32px 24px', border: '1px solid #e8e3db', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <h3 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 700 }}>Заявка принята!</h3>
                <p style={{ color: '#6b655b', marginBottom: 24 }}>Менеджер свяжется с вами в ближайшее время.</p>
                <div style={{ background: '#f1efec', borderRadius: 10, padding: '16px', marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: '#9d9690', marginBottom: 4 }}>Номер заявки</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 20, color: '#d4613a' }}>{done.cardId}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => { setId(done.cardId); setTab('track') }} style={{ padding: '12px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
                    Отследить заказ
                  </button>
                  {done.clientUrl && (
                    <a href={done.clientUrl} style={{ padding: '12px', background: '#f1efec', color: '#26231f', borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: 'none', display: 'block' }}>
                      Открыть личный кабинет
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 14, padding: '24px 20px', border: '1px solid #e8e3db' }}>
                <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700, color: '#211f1c' }}>Оставить заявку</h3>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 5 }}>Имя / Компания *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя или компания" style={inp} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 5 }}>Телефон *</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 700 000 0000" style={inp} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 5 }}>Что нужно? *</label>
                  <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
                    placeholder="Профнастил МП-20 коричневый 40 листов, оцинковка 0.5мм 2 рулона..."
                    style={{ ...inp, resize: 'vertical' } as React.CSSProperties} />
                </div>
                {err && <div style={{ background: '#faeaea', color: '#b03020', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{err}</div>}
                <button onClick={submitRequest} disabled={loading} style={{ width: '100%', padding: '13px', background: loading ? '#e0dbd3' : '#d4613a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Отправляем...' : 'Отправить заявку'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
