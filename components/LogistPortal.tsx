'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchLogistOrders, fetchDirectory, orderAction, createOrder, createDailyReport } from '@/lib/api'
import { COLORS } from '@/lib/colors'
import { statusStyle } from '@/lib/display'
import type { Order, Position, SessionUser, DailyReportRow } from '@/lib/types'

// ─── Types ─────────────────────────────────────────────────────

type LogistTab = 'in' | 'out' | 'new' | 'shift'

interface PositionView {
  position: Position
  order: Order
  index: number
}

function newShiftRow(): DailyReportRow {
  return {
    id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    reportId: '',
    fromWho: '',
    name: '',
    qtyIn: 0,
    commentIn: '',
    toWho: '',
    qtyOut: 0,
    commentOut: '',
    invoiceNum: '',
  }
}

// ─── Shared UI ─────────────────────────────────────────────────

function Btn({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  disabled = false,
  style,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'default' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  disabled?: boolean
  style?: React.CSSProperties
}) {
  const base: React.CSSProperties = {
    border: 'none',
    borderRadius: 10,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    fontFamily: 'inherit',
    fontSize: size === 'sm' ? 11 : 13,
    padding: size === 'sm' ? '6px 12px' : '10px 16px',
  }
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: COLORS.primary, color: COLORS.white },
    default: { background: COLORS.white, color: COLORS.text, border: `1px solid #d8d3cc` },
    danger: { background: COLORS.white, color: '#b03020', border: '1px solid #e6dcd6' },
    ghost: { background: 'transparent', color: COLORS.textMuted },
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  return <span style={statusStyle(status)}>{status}</span>
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: `1px solid ${COLORS.border}`,
  borderRadius: 10,
  fontSize: 14,
  fontFamily: 'inherit',
  color: COLORS.text,
  background: COLORS.white,
  outline: 'none',
}

const PORTAL_BG = '#dedbd6'

// ─── Position Card ─────────────────────────────────────────────

function PositionCard({
  item,
  onStatus,
  loading,
}: {
  item: PositionView
  onStatus: (status: string) => void
  loading: boolean
}) {
  const { position: p, order, index } = item
  const name = p.name1c || p.oral || 'Позиция'

  const buttons: { label: string; status: string; match: string[] }[] = [
    { label: 'ПРИНЯЛ', status: 'В работе', match: ['В работе', 'Готово к отгрузке', 'В пути', 'Доставлено'] },
    { label: 'В РАБОТЕ', status: 'В пути', match: ['В пути', 'Доставлено'] },
    { label: 'ДОСТАВЛЕНО', status: 'Доставлено', match: ['Доставлено'] },
  ]

  function isActive(match: string[]): boolean {
    return match.includes(p.status)
  }

  function activeLevel(): number {
    if (p.status === 'Доставлено') return 3
    if (p.status === 'В пути') return 2
    if (p.status === 'В работе' || p.status === 'Готово к отгрузке') return 1
    return 0
  }

  const level = activeLevel()

  return (
    <div
      style={{
        background: COLORS.white,
        borderRadius: 14,
        padding: '16px 16px 14px',
        marginBottom: 10,
        boxShadow: '0 2px 8px rgba(33,31,28,.06)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, flex: 1 }}>{name}</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.primary, whiteSpace: 'nowrap' }}>
          {p.qty} {p.unit}
        </div>
      </div>

      <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 8 }}>
        {order.from} → {order.to || '—'}
      </div>

      {order.comment && (
        <div style={{ fontSize: 12.5, color: COLORS.textMuted, background: COLORS.bgCard, borderRadius: 8, padding: '8px 10px', marginBottom: 10, lineHeight: 1.4 }}>
          {order.comment.length > 100 ? order.comment.slice(0, 100) + '…' : order.comment}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: COLORS.textSubtle }}>
          {order.id} · поз. {index + 1}
        </span>
        <StatusBadge status={p.status || 'В ожидании'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {buttons.map((b, i) => {
          const active = level >= i + 1 && isActive(b.match)
          const isCurrent = p.status === b.status || (b.status === 'В работе' && p.status === 'Готово к отгрузке' && level === 1)
          return (
            <button
              key={b.label}
              type="button"
              disabled={loading}
              onClick={() => onStatus(b.status)}
              style={{
                padding: '10px 4px',
                borderRadius: 10,
                border: 'none',
                fontWeight: 700,
                fontSize: 10.5,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                background: isCurrent || active ? COLORS.primary : COLORS.bgCard,
                color: isCurrent || active ? COLORS.white : COLORS.textMuted,
                opacity: loading ? 0.6 : 1,
                transition: 'background .15s',
              }}
            >
              {b.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────

export default function LogistPortal({ user }: { user: SessionUser }) {
  const [tab, setTab] = useState<LogistTab>('in')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [shiftRows, setShiftRows] = useState<DailyReportRow[]>([])
  const [shiftComment, setShiftComment] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)

  const [newTo, setNewTo] = useState('')
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const [creating, setCreating] = useState(false)
  const [directory, setDirectory] = useState<{ logists: { name: string }[]; fromUsers: { name: string }[] }>({ logists: [], fromUsers: [] })

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2300)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchLogistOrders()
      setOrders(data)
    } catch {
      showToast('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetchDirectory()
      .then(d => setDirectory({ logists: d.logists || [], fromUsers: d.fromUsers || [] }))
      .catch(() => {})
  }, [])

  const incoming = useMemo((): PositionView[] => {
    const items: PositionView[] = []
    orders.forEach(order => {
      order.positions.forEach((p, index) => {
        if (p.resp === user.name) {
          items.push({ position: p, order, index })
        }
      })
    })
    return items.sort((a, b) => new Date(b.order.updatedAt).getTime() - new Date(a.order.updatedAt).getTime())
  }, [orders, user.name])

  const outgoing = useMemo((): PositionView[] => {
    const items: PositionView[] = []
    orders.forEach(order => {
      if (order.from !== user.name) return
      order.positions.forEach((p, index) => {
        items.push({ position: p, order, index })
      })
    })
    return items.sort((a, b) => new Date(b.order.updatedAt).getTime() - new Date(a.order.updatedAt).getTime())
  }, [orders, user.name])

  function appendShiftRow(item: PositionView, newStatus: string) {
    const name = item.position.name1c || item.position.oral
    const qty = item.position.qty
    setShiftRows(prev => {
      const row = newShiftRow()
      if (newStatus === 'В работе') {
        row.fromWho = item.order.from
        row.name = name
        row.qtyIn = qty
        row.commentIn = `Принято · ${item.order.id}`
        row.toWho = user.name
      } else if (newStatus === 'В пути') {
        row.fromWho = user.name
        row.name = name
        row.qtyOut = qty
        row.commentOut = `В пути · ${item.order.id}`
        row.toWho = item.order.to
      } else if (newStatus === 'Доставлено') {
        row.fromWho = user.name
        row.name = name
        row.qtyOut = qty
        row.commentOut = `Доставлено · ${item.order.id}`
        row.toWho = item.order.to
      }
      return [...prev, row]
    })
  }

  async function updatePosition(item: PositionView, status: string) {
    setActionLoading(item.position.id)
    try {
      await orderAction(item.order.id, 'updatePos', { posId: item.position.id, status })
      appendShiftRow(item, status)
      showToast(`Статус: ${status}`)
      await load()
    } catch {
      showToast('Ошибка обновления')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCreate() {
    if (!newName.trim() || !newQty.trim()) {
      showToast('Заполните наименование и количество')
      return
    }
    setCreating(true)
    try {
      await createOrder({
        from: user.name,
        to: newTo,
        comment: `${newName} — ${newQty} шт`,
        source: 'responsible_portal',
        positions: [{
          oral: newName,
          name1c: newName,
          qty: parseFloat(newQty) || 0,
          unit: 'шт',
          resp: user.name,
          status: 'В работе',
        }],
      })
      showToast('Позиция создана')
      setNewTo('')
      setNewName('')
      setNewQty('')
      setTab('out')
      await load()
    } catch {
      showToast('Ошибка создания')
    } finally {
      setCreating(false)
    }
  }

  async function submitShift() {
    setSubmittingReport(true)
    try {
      await createDailyReport({
        date: new Date().toISOString().slice(0, 10),
        comment: shiftComment,
        rows: shiftRows.map(({ id: _id, reportId: _rid, ...rest }) => rest),
      })
      showToast('Смена закрыта и отправлена')
      setShiftRows([])
      setShiftComment('')
    } catch {
      showToast('Ошибка отправки отчёта')
    } finally {
      setSubmittingReport(false)
    }
  }

  function updateRow(idx: number, field: keyof DailyReportRow, value: string | number) {
    setShiftRows(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }

  const shiftStats = useMemo(() => ({
    total: shiftRows.length,
    income: shiftRows.filter(r => r.qtyIn > 0).length,
    expense: shiftRows.filter(r => r.qtyOut > 0).length,
  }), [shiftRows])

  const now = new Date()
  const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  const tabs: { id: LogistTab; icon: string; label: string; badge: number }[] = [
    { id: 'in', icon: '📥', label: 'Входящие', badge: incoming.length },
    { id: 'out', icon: '📤', label: 'Исходящие', badge: outgoing.length },
    { id: 'new', icon: '➕', label: 'Новый', badge: 0 },
    { id: 'shift', icon: '📊', label: 'Смена', badge: shiftRows.length },
  ]

  const list = tab === 'in' ? incoming : tab === 'out' ? outgoing : []

  return (
    <div style={{ minHeight: '100vh', background: PORTAL_BG, padding: '12px 12px 90px' }}>
      <div
        style={{
          maxWidth: 432,
          margin: '0 auto',
          background: COLORS.bg,
          borderRadius: 22,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(33,31,28,.12)',
          minHeight: 'calc(100vh - 24px)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ background: COLORS.dark, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: COLORS.primary,
              color: COLORS.white,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            U
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 14 }}>U-Kan · Портал</div>
          </div>
          <div style={{ color: '#8c857a', fontSize: 12.5, fontWeight: 500 }}>{user.name}</div>
        </div>

        {/* Content */}
        <div className="anim-fade" style={{ flex: 1, padding: '16px 14px 20px', overflowY: 'auto' }}>
          {tab === 'in' && (
            <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>Входящие · ко мне</h2>
          )}
          {tab === 'out' && (
            <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>Исходящие · от меня</h2>
          )}

          {(tab === 'in' || tab === 'out') && (
            loading ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {[1, 2].map(i => (
                  <div key={i} style={{ height: 140, background: COLORS.borderLight, borderRadius: 14 }} />
                ))}
              </div>
            ) : list.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: COLORS.textMuted }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{tab === 'in' ? '📥' : '📤'}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Позиций нет</div>
              </div>
            ) : (
              list.map(item => (
                <PositionCard
                  key={item.position.id}
                  item={item}
                  loading={actionLoading === item.position.id}
                  onStatus={status => updatePosition(item, status)}
                />
              ))
            )
          )}

          {tab === 'new' && (
            <div>
              <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Новая позиция</h2>
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, display: 'block', marginBottom: 5 }}>ОТ КОГО</label>
                  <input style={{ ...inputStyle, background: COLORS.bgCard, color: COLORS.textMuted }} value={user.name} disabled />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, display: 'block', marginBottom: 5 }}>КОМУ</label>
                  <select style={inputStyle} value={newTo} onChange={e => setNewTo(e.target.value)}>
                    <option value="">Выберите…</option>
                    {directory.logists.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
                    {directory.fromUsers.map(u => <option key={`f-${u.name}`} value={u.name}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, display: 'block', marginBottom: 5 }}>НАИМЕНОВАНИЕ</label>
                  <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Профнастил С-8" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, display: 'block', marginBottom: 5 }}>КОЛ-ВО</label>
                  <input style={inputStyle} value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="10" inputMode="decimal" />
                </div>
                <Btn variant="primary" onClick={handleCreate} disabled={creating} style={{ width: '100%', marginTop: 4 }}>
                  Создать позицию
                </Btn>
              </div>
            </div>
          )}

          {tab === 'shift' && (
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Отчёт по смене</h2>
              <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginBottom: 14 }}>
                {dateStr} · {timeStr}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Всего', value: shiftStats.total },
                  { label: 'Приход', value: shiftStats.income },
                  { label: 'Расход', value: shiftStats.expense },
                ].map(t => (
                  <div key={t.label} style={{ background: COLORS.white, borderRadius: 10, padding: '12px 8px', textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{t.value}</div>
                    <div style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 2 }}>{t.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, minWidth: 520 }}>
                  <thead>
                    <tr style={{ background: COLORS.dark, color: COLORS.white }}>
                      {['ОТ КОГО', 'НАИМ', 'ШТ', 'КОММ', 'К КОМУ', 'ШТ', 'КОММ', '№ НАКЛ'].map(h => (
                        <th key={h} style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shiftRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '20px 8px', textAlign: 'center', color: COLORS.textMuted, fontSize: 12 }}>
                          Строки появятся при смене статусов позиций
                        </td>
                      </tr>
                    ) : (
                      shiftRows.map((row, idx) => (
                        <tr key={row.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <td style={{ padding: 2 }}><input style={{ ...inputStyle, fontSize: 10, padding: '4px 6px' }} value={row.fromWho} onChange={e => updateRow(idx, 'fromWho', e.target.value)} /></td>
                          <td style={{ padding: 2 }}><input style={{ ...inputStyle, fontSize: 10, padding: '4px 6px' }} value={row.name} onChange={e => updateRow(idx, 'name', e.target.value)} /></td>
                          <td style={{ padding: 2, width: 44 }}><input style={{ ...inputStyle, fontSize: 10, padding: '4px 6px' }} type="number" value={row.qtyIn || ''} onChange={e => updateRow(idx, 'qtyIn', parseFloat(e.target.value) || 0)} /></td>
                          <td style={{ padding: 2 }}><input style={{ ...inputStyle, fontSize: 10, padding: '4px 6px' }} value={row.commentIn} onChange={e => updateRow(idx, 'commentIn', e.target.value)} /></td>
                          <td style={{ padding: 2 }}><input style={{ ...inputStyle, fontSize: 10, padding: '4px 6px' }} value={row.toWho} onChange={e => updateRow(idx, 'toWho', e.target.value)} /></td>
                          <td style={{ padding: 2, width: 44 }}><input style={{ ...inputStyle, fontSize: 10, padding: '4px 6px' }} type="number" value={row.qtyOut || ''} onChange={e => updateRow(idx, 'qtyOut', parseFloat(e.target.value) || 0)} /></td>
                          <td style={{ padding: 2 }}><input style={{ ...inputStyle, fontSize: 10, padding: '4px 6px' }} value={row.commentOut} onChange={e => updateRow(idx, 'commentOut', e.target.value)} /></td>
                          <td style={{ padding: 2, width: 52 }}><input style={{ ...inputStyle, fontSize: 10, padding: '4px 6px' }} value={row.invoiceNum} onChange={e => updateRow(idx, 'invoiceNum', e.target.value)} /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <Btn variant="default" size="sm" onClick={() => setShiftRows(prev => [...prev, newShiftRow()])} style={{ marginBottom: 14 }}>
                ＋ Добавить строку
              </Btn>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, display: 'block', marginBottom: 5 }}>КОММЕНТАРИЙ К СМЕНЕ</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 72, resize: 'vertical', fontSize: 13 }}
                  value={shiftComment}
                  onChange={e => setShiftComment(e.target.value)}
                  placeholder="Заметки по смене..."
                />
              </div>

              <Btn
                variant="primary"
                onClick={submitShift}
                disabled={submittingReport || shiftRows.length === 0}
                style={{ width: '100%' }}
              >
                ✓ Закрыть смену и отправить в бухгалтерию
              </Btn>
            </div>
          )}
        </div>

        {/* Bottom tabs */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: COLORS.white,
            borderTop: `1px solid ${COLORS.border}`,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            padding: '8px 4px 10px',
          }}
        >
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 4px',
                fontFamily: 'inherit',
                position: 'relative',
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 2 }}>{t.icon}</div>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  color: tab === t.id ? COLORS.primary : COLORS.textMuted,
                }}
              >
                {t.label}
              </div>
              {t.badge > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: '18%',
                    background: COLORS.primary,
                    color: COLORS.white,
                    fontSize: 9,
                    fontWeight: 700,
                    borderRadius: 10,
                    padding: '1px 5px',
                    minWidth: 16,
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            background: COLORS.dark,
            color: COLORS.white,
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 13,
            zIndex: 9999,
            maxWidth: 400,
            textAlign: 'center',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}