'use client'
import { useState, useEffect, useCallback } from 'react'

interface Position { id: string; name1c: string; oral: string; qty: number; unit: string; status: string }
interface Order {
  id: string; from: string; to: string; status: string; screen: string
  comment: string; createdAt: string; isDraft: boolean; isCancelled: boolean
  positions: Position[]; trackingLink?: string; isChanged: boolean
}

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''
const sc = (s: string): { bg: string; color: string } => ({
  'В ожидании': { bg: '#eef2ff', color: '#4a5aaa' }, 'В работе': { bg: '#fff0ea', color: '#c0532a' },
  'В пути': { bg: '#fdf8e1', color: '#8a6f00' }, 'Доставлено': { bg: '#e8f5ee', color: '#2e8a5e' },
  'Отменён': { bg: '#faeaea', color: '#b03020' }, 'Черновик': { bg: '#efece8', color: '#6b655b' },
}[s] || { bg: '#f1efec', color: '#6b655b' })

const PCT: Record<string, number> = { 'В работе': 10, 'Готово к отгрузке': 60, 'В пути': 80, 'Доставлено': 100 }

export default function ClientApp({ userName, slug }: { userName: string; slug: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [tab, setTab] = useState<'orders' | 'new' | 'track'>('orders')
  const [selected, setSelected] = useState<Order | null>(null)
  const [text, setText] = useState('')
  const [deadline, setDeadline] = useState('')
  const [trackId, setTrackId] = useState('')
  const [trackData, setTrackData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [changeText, setChangeText] = useState('')
  const [changePhone, setChangePhone] = useState('')
  const [showChange, setShowChange] = useState(false)

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const loadOrders = useCallback(async () => {
    const d = await fetch('/api/client/orders').then(r => r.json())
    setOrders(Array.isArray(d) ? d : [])
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  const submit = async (draft = false) => {
    if (!text.trim() && !draft) { showToast('Напишите что нужно'); return }
    setLoading(true)
    try {
      const d = await fetch('/api/client/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, deadline, isDraft: draft }),
      }).then(r => r.json())
      showToast(draft ? 'Черновик сохранён' : 'Заявка отправлена!')
      setText(''); setDeadline(''); setTab('orders')
      loadOrders()
    } catch { showToast('Ошибка') }
    finally { setLoading(false) }
  }

  const sendTrack = async () => {
    if (!trackId.trim()) return
    setLoading(true)
    try {
      const d = await fetch(`/api/track?id=${encodeURIComponent(trackId.trim())}`).then(r => r.json())
      setTrackData(d)
    } catch { showToast('Не найдено') }
    finally { setLoading(false) }
  }

  const sendChange = async (orderId: string) => {
    if (!changeText || !changePhone) { showToast('Заполните все поля'); return }
    await fetch('/api/track/change', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: orderId, changeText, changePhone }),
    })
    showToast('Изменение отправлено'); setShowChange(false); setChangeText(''); setChangePhone('')
  }

  const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', border: '1.5px solid #e0dbd3', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', color: '#26231f', outline: 'none', boxSizing: 'border-box' }

  const active = orders.filter(o => !o.isDraft && !o.isCancelled && o.screen !== 'archive')
  const drafts = orders.filter(o => o.isDraft)
  const done = orders.filter(o => o.status === 'Доставлено' || o.screen === 'archive')

  const OrderCard = ({ o }: { o: Order }) => {
    const pct = o.positions.length === 0 ? 0 : Math.round(o.positions.reduce((s, p) => s + (PCT[p.status] || 0), 0) / o.positions.length)
    const c = sc(o.status)
    return (
      <div onClick={() => setSelected(o)} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 8, border: '1px solid #e8e3db', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#d4613a' }}>{o.id}</span>
          <span style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{o.status}</span>
        </div>
        {o.positions.length > 0 && (
          <>
            <div style={{ background: '#e8e3db', borderRadius: 4, height: 5, marginBottom: 4 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#3a9d6e' : '#d4613a', borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 11, color: '#9d9690' }}>{pct}% · {o.positions.length} позиций</div>
          </>
        )}
        <div style={{ fontSize: 11, color: '#9d9690', marginTop: 4 }}>{fmt(o.createdAt)}</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: 16, fontFamily: 'Golos Text, system-ui, sans-serif', minHeight: '100vh' }}>
      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#d4613a', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>Ю</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#211f1c' }}>U-Kan</div>
            <div style={{ fontSize: 12, color: '#9d9690' }}>{userName}</div>
          </div>
        </div>
        <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login' }}
          style={{ padding: '7px 14px', background: '#f1efec', color: '#6b655b', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Выйти
        </button>
      </div>

      {/* Табы */}
      <div style={{ display: 'flex', background: '#fff', borderRadius: 12, padding: 4, marginBottom: 20, border: '1px solid #e8e3db' }}>
        {([
          { k: 'orders', label: `Мои заказы (${active.length})` },
          { k: 'new', label: '+ Новая заявка' },
          { k: 'track', label: '🔍 Отследить' },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            flex: 1, padding: '10px 8px', border: 'none', borderRadius: 9, cursor: 'pointer',
            background: tab === t.k ? '#d4613a' : 'none', color: tab === t.k ? '#fff' : '#6b655b',
            fontWeight: tab === t.k ? 700 : 400, fontSize: 13, fontFamily: 'inherit',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Заказы */}
      {tab === 'orders' && (
        <div>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9d9690' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Заказов пока нет</div>
              <button onClick={() => setTab('new')} style={{ padding: '10px 20px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Создать первый
              </button>
            </div>
          ) : (
            <>
              {active.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9d9690', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>Активные</div>
                  {active.map(o => <OrderCard key={o.id} o={o} />)}
                </div>
              )}
              {drafts.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9d9690', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>Черновики</div>
                  {drafts.map(o => <OrderCard key={o.id} o={o} />)}
                </div>
              )}
              {done.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9d9690', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>Завершённые</div>
                  {done.map(o => <OrderCard key={o.id} o={o} />)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Новая заявка */}
      {tab === 'new' && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '24px 20px', border: '1px solid #e8e3db' }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 700, color: '#211f1c' }}>Новая заявка</h3>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 5 }}>Что нужно? *</label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
              placeholder="Напишите что нужно: профнастил 50 листов RAL8017, оцинковка 1 рулон 0.5мм..."
              style={{ ...inp, resize: 'vertical' } as React.CSSProperties} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 5 }}>Нужно к дате</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inp} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => submit(true)} disabled={loading} style={{ flex: 1, padding: '12px', background: '#f1efec', color: '#26231f', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Черновик
            </button>
            <button onClick={() => submit(false)} disabled={loading} style={{ flex: 2, padding: '12px', background: loading ? '#e0dbd3' : '#d4613a', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Отправляем...' : 'Отправить заявку'}
            </button>
          </div>
        </div>
      )}

      {/* Трекинг */}
      {tab === 'track' && (
        <div>
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #e8e3db', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={trackId} onChange={e => setTrackId(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendTrack()} placeholder="Введите номер заказа C-001-..." style={{ ...inp, flex: 1 }} />
              <button onClick={sendTrack} disabled={loading} style={{ padding: '11px 18px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                {loading ? '...' : 'Найти'}
              </button>
            </div>
          </div>
          {trackData && (
            <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #e8e3db', animation: 'ukfade .2s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#d4613a', fontSize: 14 }}>{String(trackData.id)}</div>
                  <div style={{ fontSize: 22, margin: '8px 0 4px' }}>{String(trackData.heroIcon)}</div>
                </div>
                <span style={{ background: '#e8f5ee', color: '#2e8a5e', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>{String(trackData.status)}</span>
              </div>
              <div style={{ background: '#e8e3db', borderRadius: 4, height: 8, marginBottom: 12 }}>
                <div style={{ width: `${Number(trackData.progress)}%`, height: '100%', background: '#d4613a', borderRadius: 4, transition: 'width .5s' }} />
              </div>
              <div style={{ fontSize: 13, color: '#6b655b', marginBottom: 8 }}>Прогресс: {String(trackData.progress)}%</div>
              {Array.isArray(trackData.positions) && trackData.positions.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9d9690', marginBottom: 8, textTransform: 'uppercase' }}>Позиции</div>
                  {(trackData.positions as { name: string; qty: number; unit: string; status: string }[]).map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1efec', fontSize: 13 }}>
                      <span>{p.name} — {p.qty} {p.unit}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: p.status === 'Доставлено' ? '#2e8a5e' : '#9d9690' }}>{p.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Детали заказа */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end', padding: 0 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '85vh', background: '#fff', borderRadius: '16px 16px 0 0', overflow: 'auto', padding: '20px 20px 32px', animation: 'ukpop .18s ease' }}>
            <div style={{ width: 40, height: 4, background: '#e0dbd3', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#d4613a', fontSize: 14 }}>{selected.id}</div>
                <div style={{ fontSize: 13, color: '#9d9690', marginTop: 2 }}>{fmt(selected.createdAt)}</div>
              </div>
              <span style={{ background: sc(selected.status).bg, color: sc(selected.status).color, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{selected.status}</span>
            </div>

            {selected.comment && (
              <div style={{ background: '#fafaf9', borderRadius: 8, padding: '12px 14px', marginBottom: 12, fontSize: 13, color: '#26231f', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.comment}</div>
            )}

            {selected.positions.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9d9690', marginBottom: 6, textTransform: 'uppercase' }}>Позиции</div>
                {selected.positions.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1efec', fontSize: 13 }}>
                    <span>{p.name1c || p.oral} — {p.qty} {p.unit}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: p.status === 'Доставлено' ? '#2e8a5e' : '#9d9690' }}>{p.status}</span>
                  </div>
                ))}
              </div>
            )}

            {selected.trackingLink && (
              <a href={selected.trackingLink} style={{ display: 'block', textAlign: 'center', padding: '11px', background: '#eef2ff', color: '#4a5aaa', borderRadius: 9, fontWeight: 600, fontSize: 14, textDecoration: 'none', marginBottom: 8 }}>
                🔍 Отследить заказ
              </a>
            )}

            {!selected.isCancelled && selected.status !== 'Доставлено' && (
              <div style={{ marginTop: 12 }}>
                {!showChange ? (
                  <button onClick={() => setShowChange(true)} style={{ width: '100%', padding: '11px', background: '#fff0ea', color: '#c0532a', border: '1px solid #f4c4a8', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✏ Изменить заказ
                  </button>
                ) : (
                  <div style={{ background: '#fafaf9', borderRadius: 10, padding: '14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Что изменить?</div>
                    <textarea value={changeText} onChange={e => setChangeText(e.target.value)} rows={3} placeholder="Опишите изменения..."
                      style={{ ...inp, resize: 'none', marginBottom: 8 } as React.CSSProperties} />
                    <input value={changePhone} onChange={e => setChangePhone(e.target.value)} placeholder="Ваш телефон для связи" style={{ ...inp, marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setShowChange(false)} style={{ flex: 1, padding: '10px', background: '#f1efec', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Отмена</button>
                      <button onClick={() => sendChange(selected.id)} style={{ flex: 2, padding: '10px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Отправить</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#211f1c', color: '#fff', padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 500, zIndex: 200, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
