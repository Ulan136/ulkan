'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { orderAction, logout } from '@/lib/api'
import { SessionUser } from '@/lib/types'
import { cardProgress } from '@/lib/display'
import { useLiveData } from '@/lib/live'
import { PositionEditor, AddPositionForm, editBtn } from '@/components/PositionEditors'
import CardChat from '@/components/CardChat'
import ChatWidget from '@/components/ChatWidget'
import { POS_STATUS } from '@/lib/orderStatus'
import { isHandedOff, isInDelivery, myActivePos, myHandedPos, eqName } from '@/lib/positionState'

const PRIMARY = '#d4613a'
const BG = '#f1efec'

interface Position {
  id: string; cardId: string; name1c: string; oral: string
  qty: number; unit: string; status: string; resp: string; supplier: string; leg?: number
}
interface HistoryItem {
  id: string; action: string; userName: string; createdAt: string
}
interface Order {
  id: string; from: string; to: string; screen: string; status: string
  deadline?: string; createdAt: string; updatedAt: string
  trackingLink: string; positions: Position[]
  history?: HistoryItem[]
}

type Tab = 'in' | 'out' | 'new'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'В работе': { bg: '#fff0ea', color: '#c0532a' },
    'В ожидании': { bg: '#eef2ff', color: '#4a5aaa' },
    'Новая заявка': { bg: '#eef2ff', color: '#4a5aaa' },
    'В пути': { bg: '#fdf8e1', color: '#8a6f00' },
    'Доставлено': { bg: '#e8f5ee', color: '#2e8a5e' },
    'Принято филиалом': { bg: '#e8f5ee', color: '#2e8a5e' },
    'Готово к отгрузке': { bg: '#fdf8e1', color: '#8a6f00' },
    'Архив': { bg: '#efece8', color: '#6b655b' },
  }
  const s = map[status] || { bg: '#efece8', color: '#6b655b' }
  return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>
}

function barColor(pct: number) { return pct >= 100 ? '#3a9d6e' : pct >= 60 ? '#c4a832' : PRIMARY }

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fmtTime(d?: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' · ' +
    dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

interface Props { user: SessionUser; branchUser: { name: string; slug: string; phone?: string } }

export default function BranchPortal({ user, branchUser }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('in')
  const [toast, setToast] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'positions' | 'history' | 'chat'>('positions')
  const [history, setHistory] = useState<Record<string, HistoryItem[]>>({})
  const [msgCount, setMsgCount] = useState<Record<string, number>>({})

  // Новый заказ
  const [newTo, setNewTo] = useState('')
  const [newText, setNewText] = useState('')
  const [newLoading, setNewLoading] = useState(false)
  const [newDone, setNewDone] = useState<Order | null>(null)

  function showMsg(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // Пока филиал редактирует количество позиции — не перезагружаем список
  // (иначе карточка перерисуется и потеряется ввод/фокус). Ref, чтобы не ре-рендерить.
  const editingRef = useRef(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [editPosId, setEditPosId] = useState<string | null>(null)     // редактируемая позиция
  const [addingCardId, setAddingCardId] = useState<string | null>(null) // карточка, куда добавляем

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/branch/orders')
      if (res.status === 401 || res.status === 403) { setSessionExpired(true); return }
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch {}
    finally { setLoading(false) }
  }, [])

  // Realtime канал 'orders' (+ polling-fallback). editingRef паузит обновление
  // во время редактирования позиции — сигнал копится и применяется после.
  useLiveData('orders', load, [], editingRef)

  // editingRef не должен залипать: нет открытого редактора → пауза снята.
  useEffect(() => { if (editPosId === null && addingCardId === null) editingRef.current = false }, [editPosId, addingCardId])
  // Смена вкладки закрывает открытые редакторы (иначе пауза залипла бы)
  useEffect(() => { setEditPosId(null); setAddingCardId(null) }, [tab])
  useEffect(() => () => { editingRef.current = false }, [])

  async function loadHistory(orderId: string) {
    if (history[orderId]) return
    try {
      const res = await fetch(`/api/orders/${orderId}/history`)
      const data = await res.json()
      setHistory(prev => ({ ...prev, [orderId]: Array.isArray(data) ? data : [] }))
    } catch {}
  }

  function openOrder(orderId: string) {
    if (selected === orderId) { setSelected(null); return }
    setSelected(orderId)
    setDetailTab('positions')
    loadHistory(orderId)
    fetch(`/api/orders/${orderId}/messages`).then(r => r.ok ? r.json() : []).then((d: any) => setMsgCount(prev => ({ ...prev, [orderId]: Array.isArray(d) ? d.length : 0 }))).catch(() => {})
  }

  // Вкладки — на статусном предикате (не по leg): моя позиция «активна» (ещё у
  // филиала) или «передана логисту». Плюс legacy по имени (адресованные мне /
  // мои заявки без позиций-поставщика).
  const me = branchUser.name
  // Входящие — есть моя активная позиция + legacy адресованные мне
  const incoming = orders.filter(o => myActivePos(o.positions, me).length > 0 || eqName(o.to, me))
  // Исходящие — есть моя переданная позиция + legacy мои заявки
  const outgoing = orders.filter(o => myHandedPos(o.positions, me).length > 0 || eqName(o.from, me))

  async function handleAccept(orderId: string) {
    await orderAction(orderId, 'branchAccept', { branchName: branchUser.name })
    load(); showMsg('✓ Принято — теперь передайте логисту')
  }

  async function handleForward(orderId: string) {
    await orderAction(orderId, 'branchForward', { branchName: branchUser.name })
    load(); showMsg('✓ Передано логисту для доставки')
  }

  async function handleRecall(orderId: string) {
    try {
      await orderAction(orderId, 'branchRecall', { branchName: branchUser.name })
      load(); showMsg('✓ Возвращена — можно изменить и передать снова')
    } catch (e: any) { showMsg(e.message) }
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

  const INP: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
    border: '1.5px solid #e6e2dc', background: '#fff', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box'
  }

  function OrderCard({ o, showActions }: { o: Order; showActions: boolean }) {
    const pct = cardProgress(o)
    const isOpen = selected === o.id
    const myActive = myActivePos(o.positions, me)   // мои активные (ещё у филиала)
    const myHanded = myHandedPos(o.positions, me)   // мои переданные логисту
    const toAccept  = myActive.filter(p => p.status === POS_STATUS.working)          // «В работе» → принять
    const toForward = myActive.filter(p => p.status === POS_STATUS.acceptedByBranch) // «Принято» → к логисту
    const canAccept  = toAccept.length > 0
    const canForward = toForward.length > 0
    const canRecall = myHanded.length > 0 && !myHanded.some(isInDelivery)            // передал, доставка не начата
    // Позиция редактируема филиалом: моя и ещё НЕ передана логисту (по статусу, не по leg).
    const isEditablePos = (p: Position) => eqName(p.supplier, me) && !isHandedOff(p)
    const hist = history[o.id] || []

    return (
      <div style={{ background: '#fff', borderRadius: 14, marginBottom: 10, boxShadow: '0 0 0 1.5px #e6e2dc', overflow: 'hidden' }}>
        {/* Шапка карточки */}
        <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => openOrder(o.id)}>
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
            <strong>{o.to || 'не распределено'}</strong>
            {o.deadline && <span style={{ color: '#8a847c', fontSize: 12, marginLeft: 8 }}>до {fmtDate(o.deadline)}</span>}
          </div>
          {/* Прогресс бар */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 5, background: '#f1efec', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: barColor(pct), borderRadius: 3, transition: 'width .3s' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: barColor(pct), minWidth: 36, textAlign: 'right' }}>{pct}%</span>
          </div>
        </div>

        {/* Детали */}
        {isOpen && (
          <div style={{ borderTop: '1px solid #f1efec' }}>
            {/* Кнопки действий филиала */}
            {showActions && (
              <div style={{ padding: '12px 16px', background: '#f8f6f3', borderBottom: '1px solid #f1efec', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Принять свои позиции первого плеча */}
                {canAccept && (
                  <button onClick={() => handleAccept(o.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid #b8e0c8', background: '#e8f5ee', color: '#2e8a5e', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
                    ✓ Принял ({toAccept.length})
                  </button>
                )}
                {/* Передать логисту свои принятые позиции */}
                {canForward && (
                  <button onClick={() => handleForward(o.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
                    К логисту → ({toForward.length})
                  </button>
                )}
                {/* Вернуть свои переданные позиции (доставка не начата) */}
                {canRecall && (
                  <button onClick={() => handleRecall(o.id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid #e6c9b8', background: '#fff0ea', color: '#c0532a', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
                    ← Вернуть ({myHanded.length})
                  </button>
                )}
                {/* Мои позиции в доставке — только просмотр */}
                {myHanded.length > 0 && !canRecall && (
                  <div style={{ fontSize: 12, color: '#8a847c', padding: '8px 0' }}>📦 Доставка в процессе</div>
                )}
              </div>
            )}

            {/* Вкладки Позиции / История / Чат */}
            <div style={{ display: 'flex', gap: 4, padding: '10px 16px 0' }}>
              {(['positions', 'history', 'chat'] as const).map(t => (
                <button key={t} onClick={() => setDetailTab(t)} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: detailTab === t ? PRIMARY : '#f1efec', color: detailTab === t ? '#fff' : '#8a847c' }}>
                  {t === 'positions' ? `Позиции (${o.positions.length})` : t === 'history' ? 'История' : `💬 Чат${msgCount[o.id] ? ` (${msgCount[o.id]})` : ''}`}
                </button>
              ))}
            </div>

            {/* Позиции */}
            {detailTab === 'positions' && (
              <div style={{ padding: '10px 16px' }}>
                {o.positions.length === 0
                  ? <div style={{ fontSize: 13, color: '#8a847c', padding: '8px 0' }}>Нет позиций</div>
                  : o.positions.map(p => (
                    <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid #f8f6f3' }}>
                      {editPosId === p.id ? (
                        <PositionEditor pos={p} orderId={o.id}
                          onEditing={e => { editingRef.current = e }}
                          onSaved={m => { editingRef.current = false; setEditPosId(null); load(); showMsg(m) }}
                          onCancel={() => { editingRef.current = false; setEditPosId(null) }} />
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name1c || p.oral || '—'}</div>
                            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#a39c92' }}>{p.id}</div>
                            {p.resp && <div style={{ fontSize: 11, color: '#8a847c' }}>Логист: {p.resp}</div>}
                            {p.supplier && <div style={{ fontSize: 11, color: '#8a847c' }}>Поставщик: {p.supplier}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 12, color: '#8a847c' }}>{p.qty > 0 ? `${p.qty} ${p.unit}` : '—'}</span>
                            <StatusBadge status={p.status} />
                            {isEditablePos(p) && (
                              <button onClick={() => { editingRef.current = true; setEditPosId(p.id) }} style={editBtn(false)}>Изменить</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                }

                {/* Добавить позицию (только пока мои позиции первого плеча) */}
                {o.positions.some(p => isEditablePos(p)) && (
                  addingCardId === o.id ? (
                    <AddPositionForm orderId={o.id} supplierName={branchUser.name}
                      resp={o.positions.find(p => eqName(p.supplier, branchUser.name) && p.resp)?.resp || ''}
                      onEditing={e => { editingRef.current = e }}
                      onAdded={m => { editingRef.current = false; setAddingCardId(null); load(); showMsg(m) }}
                      onCancel={() => { editingRef.current = false; setAddingCardId(null) }} />
                  ) : (
                    <button onClick={() => { editingRef.current = true; setAddingCardId(o.id) }}
                      style={{ marginTop: 10, width: '100%', padding: '9px', border: '1.5px dashed #d8d3cc', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, color: '#8a847c', fontFamily: 'inherit', fontWeight: 600 }}>
                      ＋ Добавить позицию
                    </button>
                  )
                )}
              </div>
            )}

            {/* История */}
            {detailTab === 'history' && (
              <div style={{ padding: '10px 16px' }}>
                {hist.length === 0
                  ? <div style={{ fontSize: 13, color: '#8a847c', padding: '8px 0' }}>Нет истории</div>
                  : hist.map(h => (
                    <div key={h.id} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid #f8f6f3', alignItems: 'flex-start' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e6e2dc', marginTop: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>{h.action}</div>
                        <div style={{ fontSize: 11, color: '#8a847c' }}>{h.userName} · {fmtTime(h.createdAt)}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {/* Чат */}
            {detailTab === 'chat' && (
              <div style={{ padding: '10px 16px' }}>
                <CardChat cardId={o.id} myId={user.id} height={300} onCount={n => setMsgCount(prev => ({ ...prev, [o.id]: n }))} />
              </div>
            )}

            {/* Трекинг */}
            <div style={{ padding: '10px 16px 14px' }}>
              <a href={o.trackingLink} target="_blank" rel="noreferrer" style={{ color: PRIMARY, fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>
                Трекинг →
              </a>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (sessionExpired) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Golos Text', system-ui, sans-serif" }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 340, textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.15)' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Сессия устарела</div>
          <div style={{ color: '#8a847c', fontSize: 14, marginBottom: 18 }}>Войдите заново, чтобы продолжить.</div>
          <button onClick={() => logout()} style={{ padding: '11px 24px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Выйти и войти заново
          </button>
        </div>
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

        {/* ВХОДЯЩИЕ */}
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

        {/* ИСХОДЯЩИЕ */}
        {tab === 'out' && (
          <div>
            {outgoing.length === 0
              ? <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', boxShadow: '0 0 0 1px #e6e2dc' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📤</div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Нет исходящих</div>
                </div>
              : outgoing.map(o => <OrderCard key={o.id} o={o} showActions={true} />)
            }
          </div>
        )}

        {/* НОВЫЙ ЗАКАЗ */}
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
                  <textarea style={{ ...INP, minHeight: 100, resize: 'vertical' } as any} value={newText} onChange={e => setNewText(e.target.value)} placeholder="Что нужно заказать..." required />
                </div>
                <button type="submit" disabled={newLoading} style={{ width: '100%', padding: '12px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {newLoading ? 'Отправка...' : 'ОТПРАВИТЬ ЗАЯВКУ →'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Плавающий чат-виджет (поднят над нижним меню) */}
      <ChatWidget myId={user.id} bottomOffset={80} />

      {/* Нижнее меню */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#211f1c', borderTop: '1px solid #333', display: 'flex' }}>
        {([
          { key: 'in' as Tab, icon: '📥', label: 'Входящие', badge: incoming.filter(o => myActivePos(o.positions, me).length > 0).length },
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
