'use client'
import { useState, useEffect, useCallback } from 'react'
import { orderAction, logout } from '@/lib/api'
import { SessionUser } from '@/lib/types'

const PRIMARY = '#d4613a'
const BG = '#f1efec'

interface Position {
  id: string; cardId: string; name1c: string; oral: string
  qty: number; unit: string; status: string; resp: string; supplier: string
}
interface Order {
  id: string; from: string; to: string; screen: string; status: string
  deadline?: string; createdAt: string; updatedAt: string
  trackingLink: string; positions: Position[]
}

type Tab = 'in' | 'out' | 'new'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'В работе': { bg: '#fff0ea', color: '#c0532a' },
    'В пути': { bg: '#fdf8e1', color: '#8a6f00' },
    'Доставлено': { bg: '#e8f5ee', color: '#2e8a5e' },
    'Принято филиалом': { bg: '#e8f5ee', color: '#2e8a5e' },
    'Готово к отгрузке': { bg: '#fdf8e1', color: '#8a6f00' },
  }
  const s = map[status] || { bg: '#efece8', color: '#6b655b' }
  return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>
}

function barColor(pct: number) { return pct >= 100 ? '#3a9d6e' : pct >= 60 ? '#c4a832' : PRIMARY }

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function cardProgress(o: Order) {
  if (!o.positions.length) return o.status === 'Доставлено' ? 100 : 0
  const map: Record<string, number> = { 'В работе': 10, 'Готово к отгрузке': 60, 'В пути': 80, 'Доставлено': 100 }
  return Math.round(o.positions.reduce((s, p) => s + (map[p.status] || 0), 0) / o.positions.length)
}

interface Props { user: SessionUser; branchUser: { name: string; slug: string; phone?: string } }

export default function BranchPortal({ user, branchUser }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('in')
  const [toast, setToast] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  // Новый заказ
  const [newTo, setNewTo] = useState('')
  const [newText, setNewText] = useState('')
  const [newLoading, setNewLoading] = useState(false)
  const [newDone, setNewDone] = useState<Order | null>(null)

  function showMsg(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/branch/orders')
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  // Входящие — карточки адресованные мне
  const incoming = orders.filter(o => o.to === branchUser.name)
  // Исходящие — карточки которые я отправил дальше
  const outgoing = orders.filter(o => o.from === branchUser.name)

  async function handleAccept(orderId: string) {
    await orderAction(orderId, 'branchAccept', { branchName: branchUser.name })
    load(); showMsg('✓ Принято — теперь передайте логисту')
  }

  async function handleForward(orderId: string) {
    await orderAction(orderId, 'branchForward', { branchName: branchUser.name })
    load(); showMsg('✓ Передано логисту')
  }

  async function handleNewOrder(e: React.FormEvent) {
    e.preventDefault()
    setNewLoading(true)
    try {
      const res = await fetch('/api/client/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: newTo, text: newText }),
      })
      const data = await res.json()
      setNewDone(data.order)
      setNewTo(''); setNewText('')
      load()
    } catch (e: any) { showMsg(e.message) }
    finally { setNewLoading(false) }
  }

  const INP: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, border: '1.5px solid #e6e2dc', background: '#fff', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }

  function OrderCard({ o, showActions }: { o: Order; showActions: boolean }) {
    const pct = cardProgress(o)
    const allDelivered = o.positions.length > 0 && o.positions.every(p => p.status === 'Доставлено')
    const accepted = o.status === 'Принято филиалом'
    const isOpen = selected === o.id

    return (
      <div style={{ background: '#fff', borderRadius: 14, marginBottom: 10, boxShadow: '0 0 0 1.5px #e6e2dc', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setSelected(isOpen ? null : o.id)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: PRIMARY }}>{o.id}</span>
              <StatusBadge status={o.status} />
            </div>
            <span style={{ fontSize: 11, color: '#8a847c', flexShrink: 0 }}>{fmtDate(o.createdAt)}</span>
          </div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: '#8a847c' }}>{o.from}</span>
            <span style={{ color: '#8a847c', margin: '0 4px' }}>→</span>
            <strong>{o.to}</strong>
            {o.deadline && <span style={{ color: '#8a847c', fontSize: 12, marginLeft: 8 }}>до {fmtDate(o.deadline)}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 5, background: '#f1efec', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: barColor(pct), borderRadius: 3, transition: 'width .3s' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: barColor(pct), minWidth: 36, textAlign: 'right' }}>{pct}%</span>
          </div>
        </div>

        {isOpen && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1efec' }}>
            {/* Позиции */}
            {o.positions.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8f6f3' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name1c || p.oral || '—'}</div>
                  {p.resp && <div style={{ fontSize: 11, color: '#8a847c' }}>Логист: {p.resp}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#8a847c' }}>{p.qty > 0 ? `${p.qty} ${p.unit}` : '—'}</span>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}

            {/* Кнопки действий — филиал управляет статусами */}
            {showActions && (
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {o.status !== 'Принято филиалом' && o.status !== 'В работе (плечо 2)' && (
                  <button onClick={() => handleAccept(o.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#e8f5ee', color: '#2e8a5e', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', border: '1.5px solid #b8e0c8' }}>
                    ✓ Принял
                  </button>
                )}
                {o.status === 'Принято филиалом' && (
                  <button onClick={() => handleForward(o.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
                    К логисту →
                  </button>
                )}
                {(o.status === 'В работе (плечо 2)' || o.screen === 'outgoing' && o.from === branchUser.name) && (
                  <div style={{ fontSize: 12, color: '#8a847c', padding: '10px 0' }}>📦 Передано логисту для доставки</div>
                )}
              </div>
            )}

            <a href={o.trackingLink} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 12, color: PRIMARY, fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>
              Трекинг →
            </a>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Golos Text', system-ui, sans-serif", maxWidth: 480, margin: '0 auto' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#211f1c', color: '#fff', padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 9999, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {/* Шапка */}
      <div style={{ background: '#211f1c', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: PRIMARY, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>U</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>U-Kan · Филиал</div>
            <div style={{ color: '#8c857a', fontSize: 11 }}>{branchUser.name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ background: 'none', border: 'none', color: '#8c857a', fontSize: 18, cursor: 'pointer', padding: 4 }}>⟳</button>
          <button onClick={() => logout()} style={{ background: 'none', border: '1px solid #444', color: '#ccc', fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Выйти</button>
        </div>
      </div>

      {/* Контент */}
      <div style={{ padding: '16px 12px 80px' }}>
        {loading && orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#8a847c' }}>Загрузка...</div>
        )}

        {tab === 'in' && (
          <div>
            {incoming.length === 0
              ? <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', boxShadow: '0 0 0 1px #e6e2dc' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📥</div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Нет входящих</div>
                  <div style={{ color: '#8a847c', fontSize: 13 }}>Карточки появятся когда вас назначат получателем</div>
                </div>
              : incoming.map(o => <OrderCard key={o.id} o={o} showActions={true} />)
            }
          </div>
        )}

        {tab === 'out' && (
          <div>
            {outgoing.length === 0
              ? <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', boxShadow: '0 0 0 1px #e6e2dc' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📤</div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Нет исходящих</div>
                </div>
              : outgoing.map(o => <OrderCard key={o.id} o={o} showActions={false} />)
            }
          </div>
        )}

        {tab === 'new' && (
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 0 0 1px #e6e2dc' }}>
            {newDone ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#2e8a5e', marginBottom: 8 }}>Заявка {newDone.id} создана!</div>
                <button onClick={() => { setNewDone(null); setTab('in') }} style={{ marginTop: 16, padding: '10px 24px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
                  Входящие
                </button>
              </div>
            ) : (
              <form onSubmit={handleNewOrder}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Новая заявка</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8a847c', display: 'block', marginBottom: 4 }}>ОТ КОГО</label>
                  <input style={{ ...INP, background: '#f8f6f3', color: '#8a847c' }} value={branchUser.name} disabled />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8a847c', display: 'block', marginBottom: 4 }}>КОМУ / КУДА</label>
                  <input style={INP} value={newTo} onChange={e => setNewTo(e.target.value)} placeholder="Получатель..." />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8a847c', display: 'block', marginBottom: 4 }}>ОПИСАНИЕ *</label>
                  <textarea style={{ ...INP, minHeight: 100, resize: 'vertical' }} value={newText} onChange={e => setNewText(e.target.value)} placeholder="Что нужно заказать..." required />
                </div>
                <button type="submit" disabled={newLoading} style={{ width: '100%', padding: '12px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {newLoading ? 'Отправка...' : 'ОТПРАВИТЬ ЗАЯВКУ →'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Нижнее меню */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#211f1c', borderTop: '1px solid #333', display: 'flex' }}>
        {([
          { key: 'in' as Tab, icon: '📥', label: 'Входящие', badge: incoming.length },
          { key: 'out' as Tab, icon: '📤', label: 'Исходящие', badge: outgoing.length },
          { key: 'new' as Tab, icon: '➕', label: 'Новый', badge: 0 },
        ]).map(({ key, icon, label, badge }) => (
          <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: '10px 4px 8px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, position: 'relative', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: 10, fontWeight: tab === key ? 700 : 400, color: tab === key ? PRIMARY : '#8c857a' }}>{label}</span>
            {badge > 0 && (
              <span style={{ position: 'absolute', top: 6, right: '50%', transform: 'translateX(8px)', background: PRIMARY, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, minWidth: 16, textAlign: 'center' }}>{badge}</span>
            )}
            {tab === key && <div style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, background: PRIMARY, borderRadius: 1 }} />}
          </button>
        ))}
      </div>
    </div>
  )
}
