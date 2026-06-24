'use client'
<<<<<<< HEAD

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
=======
import { useState, useEffect, useCallback } from 'react'

interface ReportRow { name: string; qty: number; unit: string; note: string }
interface Report { id: string; date: string; status: string; comment: string; rows: ReportRow[]; logist: { name: string } }
interface Order { id: string; from: string; to: string; status: string; comment: string; positions: { id: string; name1c: string; oral: string; qty: number; unit: string; status: string }[] }

const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : ''
const fmtFull = (d?: string) => d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' }) : ''

export default function LogistPortal({ userName, userId }: { userName: string; userId: string }) {
  const [tab, setTab] = useState<'active' | 'report' | 'reports' | 'profile'>('active')
  const [orders, setOrders] = useState<Order[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [selected, setSelected] = useState<Order | null>(null)
  const [rows, setRows] = useState<ReportRow[]>([{ name: '', qty: 1, unit: 'шт', note: '' }])
  const [comment, setComment] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    const [ords, reps] = await Promise.all([
      fetch('/api/orders/all').then(r => r.json()),
      fetch('/api/reports/daily').then(r => r.json()),
    ])
    setOrders(Array.isArray(ords) ? ords.filter((o: Order) => o.screen === 'outgoing') : [])
    setReports(Array.isArray(reps) ? reps.filter((r: Report) => r.logist?.name === userName) : [])
  }, [userName])

  useEffect(() => { load() }, [load])

  const addRow = () => setRows(r => [...r, { name: '', qty: 1, unit: 'шт', note: '' }])
  const removeRow = (i: number) => setRows(r => r.filter((_, j) => j !== i))
  const updateRow = (i: number, field: keyof ReportRow, val: string | number) =>
    setRows(r => r.map((row, j) => j === i ? { ...row, [field]: val } : row))

  const submitReport = async () => {
    const validRows = rows.filter(r => r.name)
    setLoading(true)
    try {
      await fetch('/api/reports/daily', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, comment, rows: validRows }),
      })
      showToast('Отчёт отправлен!')
      setRows([{ name: '', qty: 1, unit: 'шт', note: '' }]); setComment('')
      setTab('reports'); load()
    } catch { showToast('Ошибка') }
    finally { setLoading(false) }
  }

  const updatePos = async (orderId: string, posId: string, status: string) => {
    await fetch(`/api/orders/${orderId}/action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updatePos', posId, status }),
    })
    showToast('Обновлено'); load()
  }

  const inp: React.CSSProperties = { padding: '10px 12px', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#26231f', outline: 'none', background: '#fff' }
  const POS_STATUSES = ['В работе', 'Готово к отгрузке', 'В пути', 'Доставлено']

  return (
    <div style={{ maxWidth: 432, margin: '0 auto', background: '#f1efec', minHeight: '100vh', fontFamily: 'Golos Text, system-ui, sans-serif', paddingBottom: 80 }}>
      {/* Шапка */}
      <div style={{ background: '#d4613a', padding: '16px 20px', color: '#fff' }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>U-Kan · Логист</div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{userName}</div>
      </div>

      {/* Контент */}
      <div style={{ padding: '16px' }}>

        {tab === 'active' && (
          <div>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#211f1c' }}>
              В работе ({orders.length})
            </h3>
            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9d9690', background: '#fff', borderRadius: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div>Все заказы выполнены</div>
              </div>
            ) : orders.map(o => (
              <div key={o.id} onClick={() => setSelected(o)} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 8, border: '1px solid #e8e3db', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#d4613a' }}>{o.id}</span>
                  <span style={{ fontSize: 11, color: '#9d9690' }}>{o.positions.length} поз.</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{o.from}</div>
                {o.positions.slice(0, 2).map(p => (
                  <div key={p.id} style={{ fontSize: 12, color: '#6b655b' }}>{p.name1c || p.oral} — {p.qty} {p.unit}</div>
                ))}
                {o.positions.length > 2 && <div style={{ fontSize: 11, color: '#9d9690' }}>ещё {o.positions.length - 2}...</div>}
              </div>
            ))}
          </div>
        )}

        {tab === 'report' && (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#211f1c' }}>Новый отчёт</h3>
            <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e8e3db', marginBottom: 12 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b655b', display: 'block', marginBottom: 4 }}>Дата смены</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b655b', display: 'block', marginBottom: 8 }}>Что сделано</label>
                {rows.map((row, i) => (
                  <div key={i} style={{ marginBottom: 8, background: '#fafaf9', borderRadius: 8, padding: '10px 12px', border: '1px solid #f1efec' }}>
                    <input value={row.name} onChange={e => updateRow(i, 'name', e.target.value)} placeholder="Позиция / работа"
                      style={{ ...inp, width: '100%', boxSizing: 'border-box', marginBottom: 6 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="number" value={row.qty} onChange={e => updateRow(i, 'qty', Number(e.target.value))} style={{ ...inp, width: 70 }} min={1} />
                      <select value={row.unit} onChange={e => updateRow(i, 'unit', e.target.value)} style={{ ...inp, flex: 1 }}>
                        {['шт', 'кг', 'лист', 'рулон', 'уп', 'м'].map(u => <option key={u}>{u}</option>)}
                      </select>
                      {rows.length > 1 && (
                        <button onClick={() => removeRow(i)} style={{ padding: '0 10px', background: '#faeaea', color: '#b03020', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                      )}
                    </div>
                    <input value={row.note} onChange={e => updateRow(i, 'note', e.target.value)} placeholder="Примечание..."
                      style={{ ...inp, width: '100%', boxSizing: 'border-box', marginTop: 6 }} />
                  </div>
                ))}
                <button onClick={addRow} style={{ padding: '9px 16px', background: '#f1efec', color: '#6b655b', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                  + Добавить позицию
                </button>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b655b', display: 'block', marginBottom: 4 }}>Комментарий</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Проблемы, замечания..."
                  style={{ ...inp, width: '100%', boxSizing: 'border-box', resize: 'none' } as React.CSSProperties} />
              </div>
            </div>

            <button onClick={submitReport} disabled={loading} style={{ width: '100%', padding: '13px', background: loading ? '#e0dbd3' : '#d4613a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Отправляем...' : 'Отправить отчёт'}
            </button>
          </div>
        )}

        {tab === 'reports' && (
          <div>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>Мои отчёты</h3>
            {reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9d9690', background: '#fff', borderRadius: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <div>Отчётов пока нет</div>
              </div>
            ) : reports.map(r => (
              <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 8, border: '1px solid #e8e3db' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{fmtFull(r.date)}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: r.status === 'approved' ? '#e8f5ee' : '#fdf8e1', color: r.status === 'approved' ? '#2e8a5e' : '#8a6f00' }}>
                    {r.status === 'approved' ? 'Принят' : r.status === 'rejected' ? 'Отклонён' : 'На проверке'}
                  </span>
                </div>
                {r.rows.map((row, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#6b655b', marginBottom: 2 }}>• {row.name} — {row.qty} {row.unit}</div>
                ))}
                {r.comment && <div style={{ fontSize: 12, color: '#9d9690', marginTop: 4, fontStyle: 'italic' }}>{r.comment}</div>}
              </div>
            ))}
          </div>
        )}

        {tab === 'profile' && (
          <div>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700 }}>Профиль</h3>
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px', border: '1px solid #e8e3db', marginBottom: 12 }}>
              <div style={{ width: 56, height: 56, background: '#d4613a', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 24 }}>{userName[0]}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#211f1c', marginBottom: 4 }}>{userName}</div>
              <div style={{ fontSize: 13, color: '#9d9690' }}>Логист · U-Kan</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e8e3db' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1efec', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, color: '#6b655b' }}>Заказов в работе</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#d4613a' }}>{orders.length}</span>
              </div>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1efec', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, color: '#6b655b' }}>Отчётов отправлено</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{reports.length}</span>
              </div>
              <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login' }}
                style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 14, color: '#b03020', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                Выйти из системы
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Нижнее меню */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 432, background: '#fff', borderTop: '1px solid #e8e3db', display: 'flex', zIndex: 50 }}>
        {([
          { k: 'active', label: 'В работе', icon: '🚚', badge: orders.length },
          { k: 'report', label: 'Отчёт', icon: '✏' },
          { k: 'reports', label: 'История', icon: '📋' },
          { k: 'profile', label: 'Профиль', icon: '👤' },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            flex: 1, padding: '12px 4px 14px', background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t.k ? '#d4613a' : '#9d9690', fontFamily: 'inherit', position: 'relative',
          }}>
            <div style={{ fontSize: 22 }}>{t.icon}</div>
            <div style={{ fontSize: 10, fontWeight: tab === t.k ? 700 : 400 }}>{t.label}</div>
            {'badge' in t && t.badge > 0 && (
              <div style={{ position: 'absolute', top: 8, right: '50%', transform: 'translateX(8px)', width: 16, height: 16, background: '#d4613a', borderRadius: '50%', fontSize: 9, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t.badge}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Модаль деталей заказа */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '80vh', background: '#fff', borderRadius: '16px 16px 0 0', overflow: 'auto', padding: '20px 20px 32px' }}>
            <div style={{ width: 40, height: 4, background: '#e0dbd3', borderRadius: 2, margin: '0 auto 16px' }} />
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#d4613a', fontSize: 14, marginBottom: 4 }}>{selected.id}</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 12 }}>{selected.from}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9d9690', marginBottom: 8, textTransform: 'uppercase' }}>Позиции</div>
            {selected.positions.map(p => (
              <div key={p.id} style={{ background: '#fafaf9', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.name1c || p.oral}</div>
                <div style={{ fontSize: 12, color: '#6b655b', marginBottom: 8 }}>{p.qty} {p.unit}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {POS_STATUSES.map(ps => (
                    <button key={ps} onClick={() => updatePos(selected.id, p.id, ps)}
                      style={{ padding: '5px 10px', background: p.status === ps ? '#d4613a' : '#f1efec', color: p.status === ps ? '#fff' : '#6b655b', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: p.status === ps ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {ps}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#211f1c', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, zIndex: 200, whiteSpace: 'nowrap' }}>
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
          {toast}
        </div>
      )}
    </div>
  )
<<<<<<< HEAD
}
=======
}

const POS_STATUSES = ['В работе', 'Готово к отгрузке', 'В пути', 'Доставлено']
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
