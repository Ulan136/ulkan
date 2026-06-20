'use client'
// components/AdminApp.tsx — rebuilt to match original U-Kan UI exactly

import { useState, useEffect, useCallback, useRef } from 'react'
import { SessionUser, Order, Screen, IncTab } from '@/lib/types'
import { fetchAllOrders, fetchDashboard, fetchSettings, orderAction, postAll, logout, createOrder } from '@/lib/api'
import { cardProgress, cardSum, isOverdue, primaryResp, srcLabel, fmtMoney, fmtDate, fmtDateTime, posPct } from '@/lib/display'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PCT: Record<string, number> = { 'В работе': 10, 'Готово к отгрузке': 60, 'В пути': 80, 'Доставлено': 100, '': 0 }

function pct(status: string) { return PCT[status] ?? 0 }

function barColor(p: number) {
  return p >= 100 ? '#3a9d6e' : p >= 60 ? '#c4a832' : '#d4613a'
}

function statusStyle(status: string): string {
  const map: Record<string, string> = {
    'В ожидании': 'background:#eef2ff;color:#4a5aaa',
    'Новая заявка': 'background:#eef2ff;color:#4a5aaa',
    'Принят': 'background:#fff0ea;color:#c0532a',
    'В обработке': 'background:#fff0ea;color:#c0532a',
    'В работе': 'background:#fff0ea;color:#c0532a',
    'Готово к отгрузке': 'background:#fdf8e1;color:#8a6f00',
    'В пути': 'background:#fdf8e1;color:#8a6f00',
    'Доставлено': 'background:#e8f5ee;color:#2e8a5e',
    'К учёту': 'background:#e8f5ee;color:#2e8a5e',
    'Бухгалтерия': 'background:#e8f5ee;color:#2e8a5e',
    'Архив': 'background:#eef2ff;color:#4a5aaa',
    'Отменён': 'background:#faeaea;color:#b03020',
    'Черновик': 'background:#efece8;color:#6b655b',
  }
  const s = map[status] || 'background:#efece8;color:#6b655b'
  return s + ';font-size:10.5px;padding:1px 9px;border-radius:20px;font-weight:600;white-space:nowrap'
}

function srcBadge(s: string): string {
  const m: Record<string, string> = { cabinet: '#eef2ff;color:#4a5aaa', external: '#fff0ea;color:#c0532a', webhook: '#f3eeff;color:#7a3aaa', admin_manual: '#eef2ff;color:#4a5aaa', responsible_portal: '#e8f5ee;color:#2e8a5e' }
  const v = m[s] || '#efece8;color:#6b655b'
  return `background:${v};font-size:10px;padding:1px 8px;border-radius:20px;font-weight:600`
}

function parseStyle(s: string): React.CSSProperties {
  const o: Record<string, string> = {}
  for (const d of s.split(';')) {
    const i = d.indexOf(':')
    if (i < 0) continue
    const k = d.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    o[k] = d.slice(i + 1).trim()
  }
  return o as React.CSSProperties
}

function Toast({ msg }: { msg: string }) {
  return <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: '#211f1c', color: '#fff', padding: '11px 20px', borderRadius: 9, fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,.22)', animation: 'uktoast .2s', zIndex: 50 }}>{msg}</div>
}

// ─── Card Detail Modal ────────────────────────────────────────────────────────

function DetailModal({ order, onClose, onAction }: { order: Order; onClose: () => void; onAction: (id: string, a: string, p?: Record<string, unknown>) => void }) {
  const prog = cardProgress(order)
  const sum = cardSum(order)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/track?id=${order.id}` : order.trackingLink

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(33,31,28,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 45, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 580, maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto', animation: 'ukpop .18s', boxShadow: '0 24px 60px rgba(0,0,0,.28)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '17px 22px', borderBottom: '1px solid #eee8e1', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 15 }}>{order.id}</span>
          <span style={parseStyle(statusStyle(order.status))}>{order.status}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#a39c92' }}>{srcLabel(order.source)} · {fmtDateTime(order.createdAt)}</span>
          <button onClick={onClose} style={{ width: 30, height: 30, border: 'none', background: '#f1ede7', borderRadius: 8, cursor: 'pointer', color: '#6b655b', fontSize: 14 }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{order.from} → {order.to || '—'}</div>
          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 20px' }}>
            <div style={{ flex: 1, height: 7, background: '#f0ece6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${prog}%`, height: '100%', borderRadius: 4, background: barColor(prog) }} />
            </div>
            <span style={{ fontSize: 12, color: '#8a847c', fontFamily: 'JetBrains Mono, monospace' }}>{prog}%</span>
          </div>
          {/* Positions */}
          <div style={{ fontSize: 10.5, color: '#a39c92', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4, marginBottom: 9 }}>
            Позиции <span style={{ color: '#c0532a' }}>· цены только в админке</span>
          </div>
          {order.positions.length === 0 && <div style={{ fontSize: 12.5, color: '#a39c92', padding: '4px 0 14px' }}>Позиции ещё не сформированы — заявка из комментария.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {order.positions.map((p, i) => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 86px 116px', gap: 10, alignItems: 'center', padding: '10px 12px', background: '#faf8f6', borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: '#b8b1a6', fontFamily: 'JetBrains Mono, monospace' }}>{i + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{p.name1c || p.oral || '—'}</span>
                  <span style={parseStyle(statusStyle(p.status || 'В работе'))}>{p.status || 'В работе'}</span>
                </div>
                <span style={{ fontSize: 12, color: '#6b655b', fontFamily: 'JetBrains Mono, monospace' }}>{p.qty} {p.unit}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(p.qty * p.price)}</span>
              </div>
            ))}
          </div>
          {/* Sum */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: '#fdf0ea', borderRadius: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 12.5, color: '#6b655b' }}>Сумма заказа</span>
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(sum)}</span>
          </div>
          {/* Tracking */}
          <div style={{ display: 'flex', gap: 9 }}>
            <input value={url} readOnly style={{ flex: 1, padding: '9px 11px', border: '1px solid #e0dcd5', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: '#6b655b', background: '#faf8f6' }} />
            <button onClick={() => { try { navigator.clipboard.writeText(url) } catch {} }} style={{ border: '1px solid #d8d3cc', background: '#fff', padding: '9px 13px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>📋 Ссылка</button>
            <a href={`/track?id=${order.id}`} target="_blank" rel="noreferrer" style={{ background: '#d4613a', color: '#fff', padding: '9px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center' }}>Трекинг →</a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Screens ──────────────────────────────────────────────────────────────────

function Dashboard({ data, onGo }: { data: Record<string, unknown> | null; onGo: (s: Screen) => void }) {
  if (!data) return <div style={{ padding: 40, color: '#a39c92', textAlign: 'center' }}>Загрузка…</div>
  const { kpi, flow, progress, attention, activity, topClients } = data as {
    kpi: Record<string, number>
    flow: Record<string, number>
    progress: Record<string, number>
    attention: Array<{ label: string; sub: string; tag: string; hue: string; screen: string }>
    activity: Array<{ text: string; sub: string; time: string }>
    topClients: Array<{ name: string; count: number; pct: number }>
  }
  const flowItems: [string, number, Screen][] = [
    ['Входящие', flow.incoming, 'incoming'],
    ['Приёмка', flow.reception, 'reception'],
    ['Исходящие', flow.outgoing, 'outgoing'],
    ['К учёту', flow.accounting, 'accounting'],
    ['Бухгалтерия', flow.bookkeeping, 'bookkeeping'],
    ['Архив', flow.archive, 'archive'],
  ]
  const ringStyle = `conic-gradient(#d4613a ${(progress.overallPct || 0) * 3.6}deg, #ece8e2 0)`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1320, animation: 'ukfade .25s' }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
        {[
          { label: 'Активных карточек', value: kpi.active, color: '#26231f' },
          { label: 'Сегодня доставлено', value: kpi.deliveredToday, color: '#2e8a5e' },
          { label: 'Просрочено', value: kpi.overdue, color: kpi.overdue ? '#c0392b' : '#26231f' },
          { label: 'В работе', value: kpi.inwork, color: '#c0532a' },
          { label: 'Оборот сегодня', value: fmtMoney(kpi.turnoverToday || 0), color: '#26231f' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: '15px 16px' }}>
            <div style={{ fontSize: 11.5, color: '#8a847c', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -.5, fontFamily: 'JetBrains Mono, monospace', color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>
      {/* Mid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr .9fr', gap: 14 }}>
        <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>Требуют внимания</div>
            <div style={{ fontSize: 11, color: '#a39c92' }}>{attention.length} всего</div>
          </div>
          {attention.length === 0 ? <div style={{ color: '#a39c92', fontSize: 13 }}>Всё в порядке</div> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attention.map((a, i) => (
                <button key={i} onClick={() => onGo(a.screen as Screen)} style={{ display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', background: '#faf8f6', border: '1px solid #ece8e2', borderRadius: 8, padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: a.hue === '25' ? '#c0392b' : a.hue === '70' ? '#c4a832' : '#3a9d6e', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600 }}>{a.label}</span>
                    <span style={{ display: 'block', fontSize: 11, color: '#8a847c' }}>{a.sub}</span>
                  </span>
                  <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap', background: a.hue === '25' ? '#faeaea' : a.hue === '70' ? '#fdf8e1' : '#e8f5ee', color: a.hue === '25' ? '#b03020' : a.hue === '70' ? '#8a6f00' : '#2e8a5e' }}>{a.tag}</span>
                </button>
              ))}
            </div>
          }
        </div>
        <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12 }}>Последние действия</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {activity.map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: 11, padding: '7px 0', borderBottom: '1px solid #f1ede7' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d4613a', marginTop: 5, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500 }}>{ev.text}</span>
                  <span style={{ display: 'block', fontSize: 11, color: '#a39c92' }}>{ev.sub}</span>
                </span>
                <span style={{ fontSize: 10.5, color: '#b8b1a6', whiteSpace: 'nowrap' }}>{fmtDateTime(ev.time)}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, alignSelf: 'flex-start', marginBottom: 8 }}>Прогресс системы</div>
          <div style={{ width: 140, height: 140, borderRadius: '50%', background: ringStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px 0 14px' }}>
            <div style={{ width: 104, height: 104, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 30, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{progress.overallPct || 0}%</span>
              <span style={{ fontSize: 11, color: '#8a847c' }}>средний %</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#6b655b' }}>
            <span><b style={{ color: '#d4613a' }}>{progress.inwork}</b> в работе</span>
            <span><b style={{ color: '#3a9d6e' }}>{progress.delivered}</b> доставлено</span>
            <span><b style={{ color: '#c0392b' }}>{progress.overdue}</b> просроч.</span>
          </div>
        </div>
      </div>
      {/* Bottom */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
        <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 14 }}>Поток карточек</div>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
            {flowItems.map(([label, value, screen]) => (
              <button key={label} onClick={() => onGo(screen)} style={{ flex: 1, background: '#faf8f6', border: '1px solid #ece8e2', borderRadius: 9, padding: '13px 8px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
                <div style={{ fontSize: 23, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#d4613a' }}>{value}</div>
                <div style={{ fontSize: 11, color: '#6b655b', marginTop: 3 }}>{label}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 14 }}>Топ заказчики · месяц</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {topClients.map(c => (
              <div key={c.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{c.name}</span>
                  <span style={{ color: '#8a847c', fontFamily: 'JetBrains Mono, monospace' }}>{c.count}</span>
                </div>
                <div style={{ height: 7, background: '#f0ece6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${c.pct}%`, height: '100%', borderRadius: 4, background: '#d4613a' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Reception({ orders, onAction, onOpen, settings }: {
  orders: Order[]
  onAction: (id: string, a: string, p?: Record<string, unknown>) => void
  onOpen: (id: string) => void
  settings: Record<string, unknown> | null
}) {
  const waiting = orders.filter(o => o.screen === 'reception' && o.block === 'waiting')
  const processing = orders.filter(o => o.screen === 'reception' && o.block === 'processing')
  const drafts = orders.filter(o => o.isDraft)

  const clients = (settings?.clients as Array<{ name: string }> | undefined) || []
  const users = (settings?.users as Array<{ name: string }> | undefined) || []
  const suppliers = (settings?.suppliers as Array<{ name: string }> | undefined) || []

  const [form, setForm] = useState({ from: '', to: '', positions: [{ name: '', qty: 1, price: 0, resp: '', supplier: '' }] })
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(isDraft: boolean) {
    if (!form.from) return
    setSubmitting(true)
    try {
      await createOrder({
        from: form.from, to: form.to,
        positions: form.positions.filter(p => p.name).map((p, i) => ({ id: `temp-${i}`, cardId: '', oral: p.name, name1c: p.name, qty: p.qty, unit: 'шт', price: p.price, resp: p.resp, supplier: p.supplier, status: 'В работе', late: false, payment: '', createdAt: '', updatedAt: '' })),
        source: 'admin_manual', isDraft,
      })
      setShowForm(false)
      setForm({ from: '', to: '', positions: [{ name: '', qty: 1, price: 0, resp: '', supplier: '' }] })
    } finally { setSubmitting(false) }
  }

  const Btn = ({ children, onClick, primary, danger, small }: { children: React.ReactNode; onClick?: () => void; primary?: boolean; danger?: boolean; small?: boolean }) => (
    <button onClick={onClick} style={{ border: `1px solid ${primary ? 'transparent' : danger ? '#e6dcd6' : '#d8d3cc'}`, background: primary ? '#d4613a' : '#fff', color: primary ? '#fff' : danger ? '#c0392b' : '#3a352f', padding: small ? '6px 10px' : '7px 13px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: small ? 11 : 12 }}>
      {children}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1180, animation: 'ukfade .25s' }}>
      {/* Header stats */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { label: 'В ожидании', value: waiting.length, color: '#d4613a' },
          { label: 'К приёму', value: processing.length, color: '#d4613a' },
          { label: 'Черновики', value: drafts.length, color: '#6b655b' },
        ].map(h => (
          <div key={h.label} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 8, padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#6b655b' }}>{h.label}</span>
            <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: h.color }}>{h.value}</span>
          </div>
        ))}
      </div>

      {/* Block 1: Create order */}
      <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10 }}>
        <button onClick={() => setShowForm(!showForm)} style={{ width: '100%', padding: '14px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', fontFamily: 'inherit', textAlign: 'left' }}>
          <span style={{ color: '#d4613a' }}>＋</span> Создать новый заказ
          <span style={{ fontSize: 11, color: '#a39c92', fontWeight: 400 }}>— ручной ввод, прямой путь в Исходящие</span>
        </button>
        {showForm && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1ede7' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, margin: '14px 0' }}>
              <label style={{ fontSize: 11.5, color: '#6b655b' }}>От кого
                <select value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 5, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 13 }}>
                  <option value="">Выберите…</option>
                  {clients.map(c => <option key={c.name}>{c.name}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 11.5, color: '#6b655b' }}>К кому
                <select value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 5, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 13 }}>
                  <option value="">Выберите…</option>
                  {users.map(u => <option key={u.name}>{u.name}</option>)}
                </select>
              </label>
            </div>
            {form.positions.map((pos, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 70px 90px 120px 120px 32px', gap: 7, alignItems: 'center', marginBottom: 8 }}>
                <input placeholder="Наименование…" value={pos.name} onChange={e => setForm(f => ({ ...f, positions: f.positions.map((p, j) => j === i ? { ...p, name: e.target.value } : p) }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 12.5 }} />
                <input type="number" placeholder="Кол-во" value={pos.qty} onChange={e => setForm(f => ({ ...f, positions: f.positions.map((p, j) => j === i ? { ...p, qty: +e.target.value } : p) }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 12.5 }} />
                <input type="number" placeholder="Цена" value={pos.price || ''} onChange={e => setForm(f => ({ ...f, positions: f.positions.map((p, j) => j === i ? { ...p, price: +e.target.value } : p) }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 12.5 }} />
                <select value={pos.resp} onChange={e => setForm(f => ({ ...f, positions: f.positions.map((p, j) => j === i ? { ...p, resp: e.target.value } : p) }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 12.5 }}>
                  <option value="">Ответств.</option>
                  {users.map(u => <option key={u.name}>{u.name}</option>)}
                </select>
                <select value={pos.supplier} onChange={e => setForm(f => ({ ...f, positions: f.positions.map((p, j) => j === i ? { ...p, supplier: e.target.value } : p) }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 12.5 }}>
                  <option value="">Поставщик</option>
                  {suppliers.map(s => <option key={s.name}>{s.name}</option>)}
                </select>
                <button onClick={() => setForm(f => ({ ...f, positions: f.positions.filter((_, j) => j !== i) }))} style={{ width: 32, height: 32, border: '1px solid #e6dcd6', background: '#fff', borderRadius: 7, cursor: 'pointer', color: '#b06' }}>✕</button>
              </div>
            ))}
            <button onClick={() => setForm(f => ({ ...f, positions: [...f.positions, { name: '', qty: 1, price: 0, resp: '', supplier: '' }] }))} style={{ background: 'none', border: '1px dashed #d8d3cc', color: '#6b655b', padding: '7px 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>＋ Добавить позицию</button>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <Btn onClick={() => handleSubmit(true)}>Сохранить черновик</Btn>
              <Btn primary onClick={() => handleSubmit(false)}>{submitting ? 'Отправка…' : 'ОТПРАВИТЬ ЗАКАЗ →'}</Btn>
            </div>
          </div>
        )}
      </div>

      {/* Block 2: Processing (Стол приёмки) */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          Стол приёмки <span style={{ background: '#fff0ea', color: '#c0532a', fontSize: 11, padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>{processing.length}</span>
        </div>
        {processing.length === 0 && <div style={{ color: '#a39c92', fontSize: 12.5, padding: '14px 0' }}>Стол пуст</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {processing.map(card => (
            <div key={card.id} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 13 }}>{card.id}</span>
                  <span style={{ color: '#8a847c', fontSize: 12.5, marginLeft: 8 }}>{card.from} → {card.to}</span>
                </div>
                <span style={parseStyle(statusStyle(card.status))}>{card.status}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
                {card.positions.map(p => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 18px 1.5fr 70px 90px', gap: 8, alignItems: 'center' }}>
                    <div style={{ background: '#fdf8e1', border: '1px solid #e8d87a', color: '#8a6f00', padding: '7px 9px', borderRadius: 6, fontSize: 12 }}>{p.oral || p.name1c || '—'}</div>
                    <div style={{ textAlign: 'center', color: '#b8b1a6' }}>→</div>
                    <input placeholder="Наименование 1С (поиск)…" defaultValue={p.name1c} style={{ padding: '7px 9px', border: '1px solid #ddd8d0', borderRadius: 6, fontFamily: 'inherit', fontSize: 12 }} />
                    <input defaultValue={p.qty} style={{ padding: 7, border: '1px solid #ddd8d0', borderRadius: 6, fontFamily: 'inherit', fontSize: 12 }} />
                    <input defaultValue={p.price} style={{ padding: 7, border: '1px solid #ddd8d0', borderRadius: 6, fontFamily: 'inherit', fontSize: 12, color: '#3a352f' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Btn onClick={() => onAction(card.id, 'returnOut')}>← Вернуть</Btn>
                <Btn primary onClick={() => onAction(card.id, 'process')}>ОТПРАВИТЬ В ИСХОДЯЩИЕ →</Btn>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Block 3: Waiting (Ожидание) */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          Ожидание <span style={{ background: '#fff0ea', color: '#c0532a', fontSize: 11, padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>{waiting.length}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 12 }}>
          {waiting.map(card => (
            <div key={card.id} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 12.5 }}>{card.id}</span>
                <span style={parseStyle(srcBadge(card.source))}>{srcLabel(card.source)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#6b655b', marginBottom: 6 }}>{card.from} → {card.to}</div>
              <div style={{ fontSize: 12, color: '#8a847c', background: '#faf8f6', borderRadius: 7, padding: '8px 10px', marginBottom: 10, whiteSpace: 'pre-line', maxHeight: 74, overflow: 'hidden' }}>{card.comment}</div>
              <div style={{ display: 'flex', gap: 7 }}>
                <button onClick={() => onAction(card.id, 'take')} style={{ flex: 1, background: '#d4613a', border: 'none', color: '#fff', padding: 8, borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>ПРИНЯТЬ В ОБРАБОТКУ →</button>
                <button onClick={() => onAction(card.id, 'cancel')} style={{ width: 36, border: '1px solid #e6dcd6', background: '#fff', color: '#c0392b', borderRadius: 7, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Block 4: Drafts */}
      {drafts.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            Черновики <span style={{ background: '#efece8', color: '#6b655b', fontSize: 11, padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>{drafts.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
            {drafts.map(card => (
              <div key={card.id} style={{ background: '#fff', border: '1px dashed #d8d3cc', borderRadius: 10, padding: 13 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 12.5 }}>{card.id}</span>
                <div style={{ fontSize: 12, color: '#8a847c', margin: '5px 0 9px' }}>{(card.comment || '').slice(0, 80)}</div>
                <div style={{ display: 'flex', gap: 7 }}>
                  <Btn onClick={() => onOpen(card.id)} small>Открыть</Btn>
                  <Btn onClick={() => onAction(card.id, 'accept')} small>Отправить</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  function Btn({ children, onClick, primary, danger, small }: { children: React.ReactNode; onClick?: () => void; primary?: boolean; danger?: boolean; small?: boolean }) {
    return (
      <button onClick={onClick} style={{ border: `1px solid ${primary ? 'transparent' : danger ? '#e6dcd6' : '#d8d3cc'}`, background: primary ? '#d4613a' : '#fff', color: primary ? '#fff' : danger ? '#c0392b' : '#3a352f', padding: small ? '6px 10px' : '7px 13px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: small ? 11 : 12 }}>
        {children}
      </button>
    )
  }
}

function Incoming({ orders, tab, setTab, onAction, onOpen }: {
  orders: Order[]; tab: IncTab; setTab: (t: IncTab) => void
  onAction: (id: string, a: string, p?: Record<string, unknown>) => void; onOpen: (id: string) => void
}) {
  const inc = orders.filter(o => o.screen === 'incoming')
  const newCards = inc.filter(o => !o.isDraft && !o.isCancelled && !o.toacc && (o.status === 'В ожидании' || o.status === 'Новая заявка'))
  const changed = orders.filter(o => o.isChanged && !o.isCancelled && !o.isDraft)
  const toacc = inc.filter(o => o.toacc && o.status === 'Доставлено')
  const drafts = orders.filter(o => o.isDraft)
  const cancelled = orders.filter(o => o.isCancelled)
  const tabs: [IncTab, string, Order[]][] = [['new', 'Новые', newCards], ['changed', 'Изменённые', changed], ['toacc', 'К учёту', toacc], ['drafts', 'Черновики', drafts], ['cancelled', 'Отменённые', cancelled]]
  const list = tabs.find(t => t[0] === tab)?.[2] || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1080, animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e6e2dc' }}>
        {tabs.map(([id, label, items]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '9px 14px', border: 'none', borderBottom: `2px solid ${tab === id ? '#d4613a' : 'transparent'}`, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: tab === id ? 700 : 500, color: tab === id ? '#26231f' : '#8a847c', marginBottom: -1 }}>
            {label} <span style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', padding: '0 6px', borderRadius: 20, background: tab === id ? '#fff0ea' : '#f1ede7', color: tab === id ? '#c0532a' : '#8a847c' }}>{items.length}</span>
          </button>
        ))}
      </div>
      {list.length === 0 && <div style={{ color: '#a39c92', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>Нет карточек в этой вкладке</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {list.map(card => (
          <div key={card.id} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 15, opacity: card.postponed ? .6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 13 }}>{card.id}</span>
                  <span style={parseStyle(statusStyle(card.status))}>{card.status}</span>
                  {card.isChanged && <span style={{ background: '#fdf8e1', color: '#8a6f00', fontSize: 10.5, padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>изменено</span>}
                  {card.postponed && <span style={{ background: '#efece8', color: '#8a847c', fontSize: 10.5, padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>отложено</span>}
                  <span style={parseStyle(srcBadge(card.source))}>{srcLabel(card.source)}</span>
                </div>
                <div style={{ fontSize: 13, color: '#3a352f', marginBottom: 3 }}>{card.from} → {card.to || '—'}</div>
                <div style={{ fontSize: 12, color: '#8a847c', marginBottom: 3 }}>{(card.comment || '').slice(0, 110)}</div>
                {card.isChanged && <div style={{ fontSize: 12, color: '#8a6f00', background: '#fdf8e1', border: '1px solid #e8d87a', borderRadius: 7, padding: '8px 10px', margin: '6px 0' }}>✎ {card.changeText} · тел. {card.changePhone}</div>}
                <div style={{ fontSize: 11, color: '#b8b1a6' }}>{fmtDateTime(card.createdAt)} · позиций: {card.positions.length} {card.toacc ? `· сумма ${fmtMoney(cardSum(card))}` : ''}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-end' }}>
                <button onClick={() => { try { navigator.clipboard.writeText(`${window.location.origin}/track?id=${card.id}`) } catch {} }} title="Скопировать ссылку трекинга" style={{ width: 34, height: 34, border: '1px solid #e0dcd5', background: '#fff', borderRadius: 7, cursor: 'pointer', color: '#6b655b' }}>📎</button>
                <button onClick={() => onOpen(card.id)} style={{ fontSize: 11.5, color: '#6b655b', border: '1px solid #e0dcd5', background: '#fff', borderRadius: 7, cursor: 'pointer', padding: '6px 11px', fontFamily: 'inherit', fontWeight: 600 }}>Открыть</button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12, borderTop: '1px solid #f1ede7', paddingTop: 12 }}>
              {tab === 'new' && <>
                <button onClick={() => onAction(card.id, 'postpone')} style={{ border: '1px solid #d8d3cc', background: '#fff', color: '#3a352f', padding: '7px 13px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>Отложить</button>
                <button onClick={() => onAction(card.id, 'cancel')} style={{ border: '1px solid #e6dcd6', background: '#fff', color: '#c0392b', padding: '7px 13px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>Отменить</button>
                <button onClick={() => onAction(card.id, 'accept')} style={{ background: '#d4613a', border: 'none', color: '#fff', padding: '7px 16px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>ПРИНЯТЬ →</button>
              </>}
              {tab === 'changed' && <>
                <button onClick={() => onAction(card.id, 'cancel')} style={{ border: '1px solid #e6dcd6', background: '#fff', color: '#c0392b', padding: '7px 13px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>Отклонить</button>
                <button onClick={() => onAction(card.id, 'confirmChg')} style={{ background: '#3a9d6e', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>✓ Принять изменения</button>
              </>}
              {tab === 'toacc' && <>
                <button onClick={() => onAction(card.id, 'returnOut')} style={{ border: '1px solid #d8d3cc', background: '#fff', color: '#3a352f', padding: '7px 13px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>← В Исходящие</button>
                <button onClick={() => onAction(card.id, 'sendAcc')} style={{ background: '#d4613a', border: 'none', color: '#fff', padding: '7px 16px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>Отправить в К Учёту →</button>
              </>}
              {tab === 'drafts' && <>
                <button onClick={() => onOpen(card.id)} style={{ border: '1px solid #d8d3cc', background: '#fff', color: '#3a352f', padding: '7px 13px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>Доработать</button>
                <button onClick={() => onAction(card.id, 'accept')} style={{ border: '1px solid #d8d3cc', background: '#fff', color: '#3a352f', padding: '7px 13px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>Отправить</button>
              </>}
              {tab === 'cancelled' && <>
                <span style={{ fontSize: 12, color: '#a39c92', alignSelf: 'center', marginRight: 'auto' }}>Причина: {card.cancelReason || '—'}</span>
                <button onClick={() => onAction(card.id, 'restore')} style={{ border: '1px solid #d8d3cc', background: '#fff', color: '#3a352f', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>↺ Восстановить</button>
              </>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Outgoing({ orders, onAction, onOpen }: { orders: Order[]; onAction: (id: string, a: string, p?: Record<string, unknown>) => void; onOpen: (id: string) => void }) {
  const cards = orders.filter(o => o.screen === 'outgoing' && o.status === 'В работе')
  const posStatuses = ['В работе', 'Готово к отгрузке', 'В пути', 'Доставлено']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1080, animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#8a847c' }}>Всего: <b>{cards.length}</b> карточек {cards.filter(o => isOverdue(o)).length > 0 && <span style={{ color: '#c0392b', fontWeight: 600 }}>· ⚠ просрочено: {cards.filter(o => isOverdue(o)).length}</span>}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {cards.length === 0 && <div style={{ color: '#a39c92', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>Активных заказов нет</div>}
        {cards.map(card => {
          const prog = cardProgress(card)
          const over = isOverdue(card)
          const ready = prog >= 60 && !over
          const tagStyle = over ? 'background:#faeaea;color:#b03020' : ready ? 'background:#fdf8e1;color:#8a6f00' : 'background:#fff0ea;color:#c0532a'
          const tag = over ? '⚠ Просрочено' : ready ? '✓ Готово к доставке' : 'В работе'
          return (
            <div key={card.id} style={{ background: '#fff', border: `1px solid ${over ? '#e8a0a0' : '#e6e2dc'}`, borderRadius: 10, padding: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 13 }}>{card.id}</span>
                    <span style={parseStyle(tagStyle + ';font-size:10.5px;padding:1px 9px;border-radius:20px;font-weight:600')}>{tag}</span>
                    {card.isChanged && <span style={{ background: '#fdf8e1', color: '#8a6f00', fontSize: 10.5, padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>изменено клиентом</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#6b655b' }}>{card.from} → {card.to} · срок {fmtDate(card.deadline)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#a39c92' }}>прогресс</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{prog}%</div>
                </div>
              </div>
              <div style={{ height: 6, background: '#f0ece6', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ width: `${prog}%`, height: '100%', borderRadius: 4, background: barColor(prog) }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {card.positions.map(p => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr 160px', gap: 10, alignItems: 'center', padding: '7px 10px', background: '#faf8f6', borderRadius: 7 }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{p.name1c || p.oral || '—'}</div>
                      <div style={{ fontSize: 11, color: '#a39c92' }}>{p.qty} {p.unit} · {p.resp || '—'}{p.supplier ? ' · ' + p.supplier : ''}</div>
                    </div>
                    <div style={{ height: 5, background: '#ece8e2', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct(p.status)}%`, height: '100%', borderRadius: 3, background: barColor(pct(p.status)) }} />
                    </div>
                    <select value={p.status} onChange={e => onAction(card.id, 'updatePos', { posId: p.id, status: e.target.value })} style={{ padding: '6px 8px', border: '1px solid #ddd8d0', borderRadius: 6, fontFamily: 'inherit', fontSize: 12, background: '#fff' }}>
                      {posStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #f1ede7', paddingTop: 12 }}>
                <span style={{ fontSize: 12, color: '#8a847c', marginRight: 'auto' }}>Сумма: <b>{fmtMoney(cardSum(card))}</b></span>
                <button onClick={() => onOpen(card.id)} style={{ border: '1px solid #e0dcd5', background: '#fff', color: '#6b655b', padding: '7px 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>Открыть</button>
                <button onClick={() => { try { navigator.clipboard.writeText(`${window.location.origin}/track?id=${card.id}`) } catch {} }} style={{ border: '1px solid #e0dcd5', background: '#fff', color: '#6b655b', padding: '7px 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>📎 Ссылка клиенту</button>
                <button onClick={() => onAction(card.id, 'returnOut')} style={{ border: '1px solid #d8d3cc', background: '#fff', color: '#3a352f', padding: '7px 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>← Вернуть</button>
                <button onClick={() => onAction(card.id, 'markAll')} style={{ background: '#3a9d6e', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>✓ Всё выполнено</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FilterKanban({ orders, onOpen }: { orders: Order[]; onOpen: (id: string) => void }) {
  const board = orders.filter(o => !o.isDraft && !o.isCancelled && o.screen !== 'bookkeeping')
  const byClient: Record<string, Order[]> = {}
  board.forEach(o => { (byClient[o.from] = byClient[o.from] || []).push(o) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#8a847c' }}>{board.length} карточек в {Object.keys(byClient).length} колонках</div>
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 10, alignItems: 'flex-start' }}>
        {Object.entries(byClient).map(([client, cards]) => (
          <div key={client} style={{ flexShrink: 0, width: 280, background: '#ece8e2', borderRadius: 10, padding: 11, maxHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 5px 10px' }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{client}</span>
              <span style={{ background: '#fff', color: '#6b655b', fontSize: 11, padding: '1px 9px', borderRadius: 20, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{cards.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              {cards.map(card => {
                const prog = cardProgress(card)
                return (
                  <div key={card.id} onClick={() => onOpen(card.id)} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 8, padding: 11, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 12 }}>{card.id}</span>
                      <span style={parseStyle(statusStyle(card.status))}>{card.status}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#8a847c', marginBottom: 8 }}>→ {card.to || '—'}</div>
                    <div style={{ height: 5, background: '#f0ece6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${prog}%`, height: '100%', borderRadius: 3, background: barColor(prog) }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Accounting({ orders, onAction, onOpen, onPostAll }: { orders: Order[]; onAction: (id: string, a: string, p?: Record<string, unknown>) => void; onOpen: (id: string) => void; onPostAll: () => void }) {
  const cards = orders.filter(o => o.screen === 'accounting' && o.status === 'К учёту')
  const posted = orders.filter(o => o.screen === 'bookkeeping').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1000, animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: '#fff', border: '1px solid #e6e2dc', borderRadius: 9, padding: '11px 16px' }}>
        <span style={{ fontSize: 12.5, color: '#6b655b' }}>На рассмотрении: <b style={{ fontFamily: 'JetBrains Mono, monospace', color: '#c0532a' }}>{cards.length}</b></span>
        <span style={{ fontSize: 12.5, color: '#6b655b' }}>Проведено сегодня: <b style={{ fontFamily: 'JetBrains Mono, monospace', color: '#3a9d6e' }}>{posted}</b></span>
        <button onClick={onPostAll} style={{ marginLeft: 'auto', background: '#d4613a', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12.5 }}>Все в Бухгалтерию →</button>
      </div>
      {cards.length === 0 && <div style={{ color: '#a39c92', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>Нет карточек на рассмотрении</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {cards.map(card => (
          <div key={card.id} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 15, opacity: card.postponed ? .6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 13 }}>{card.id}</span>
                  <span style={{ background: '#fff0ea', color: '#c0532a', fontSize: 11, padding: '1px 9px', borderRadius: 20, fontWeight: 600 }}>На рассмотрении</span>
                  {card.postponed && <span style={{ background: '#efece8', color: '#8a847c', fontSize: 10.5, padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>отложено</span>}
                </div>
                <div style={{ fontSize: 12.5, color: '#6b655b' }}>{card.from} → {card.to} · доставлено {fmtDate(card.delivered)} · позиций {card.positions.length}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#a39c92' }}>сумма заказа</div>
                <div style={{ fontSize: 19, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(cardSum(card))}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {card.positions.map(p => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px', gap: 8, alignItems: 'center', padding: '6px 10px', background: '#faf8f6', borderRadius: 7 }}>
                  <span style={{ fontSize: 12.5 }}>{p.name1c || p.oral || '—'}</span>
                  <span style={{ fontSize: 12, color: '#6b655b', fontFamily: 'JetBrains Mono, monospace' }}>{p.qty} {p.unit}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(p.qty * p.price)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #f1ede7', paddingTop: 12 }}>
              <button onClick={() => onAction(card.id, 'returnOut')} style={{ border: '1px solid #d8d3cc', background: '#fff', color: '#3a352f', padding: '7px 13px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>← Вернуть в Исходящие</button>
              <button onClick={() => onAction(card.id, 'postAcc')} style={{ background: '#d4613a', border: 'none', color: '#fff', padding: '7px 16px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>Провести → Бухгалтерия</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Bookkeeping({ orders, onAction, onOpen }: { orders: Order[]; onAction: (id: string, a: string, p?: Record<string, unknown>) => void; onOpen: (id: string) => void }) {
  const cards = orders.filter(o => o.screen === 'bookkeeping')
  const posted = cards.filter(o => o.posted1C).length
  const archive = orders.filter(o => o.screen === 'archive').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1000, animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#fff', border: '1px solid #e6e2dc', borderRadius: 9, padding: '11px 16px' }}>
        <span style={{ fontSize: 12.5, color: '#6b655b' }}>В работе: <b style={{ fontFamily: 'JetBrains Mono, monospace', color: '#c0532a' }}>{cards.length}</b></span>
        <span style={{ fontSize: 12.5, color: '#6b655b' }}>Проведено в 1С: <b style={{ fontFamily: 'JetBrains Mono, monospace', color: '#2e8a5e' }}>{posted}</b></span>
        <span style={{ fontSize: 12.5, color: '#6b655b' }}>В архиве: <b style={{ fontFamily: 'JetBrains Mono, monospace' }}>{archive}</b></span>
      </div>
      {cards.length === 0 && <div style={{ color: '#a39c92', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>Нет карточек в бухгалтерии</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {cards.map(card => {
          const chipStyle = (on: boolean) => ({ fontSize: 10.5, padding: '2px 9px', borderRadius: 20, fontWeight: 600, background: on ? '#e8f5ee' : '#f1ede7', color: on ? '#2e8a5e' : '#a39c92' } as React.CSSProperties)
          return (
            <div key={card.id} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 11 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 13 }}>{card.id}</span>
                    <span style={chipStyle(card.invoice)}>{card.invoice ? '✓ ' : ''}Счёт</span>
                    <span style={chipStyle(card.fact)}>{card.fact ? '✓ ' : ''}Счёт-фактура</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#6b655b' }}>{card.from} → {card.to} · доставлено {fmtDate(card.delivered)} · позиций {card.positions.length}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#a39c92' }}>сумма</div>
                  <div style={{ fontSize: 19, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(cardSum(card))}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #f1ede7', paddingTop: 12, flexWrap: 'wrap' }}>
                <button onClick={() => onAction(card.id, 'createDoc', { type: 'invoice' })} style={{ border: '1px solid #d8d3cc', background: '#fff', color: '#3a352f', padding: '7px 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>📄 Счёт</button>
                <button onClick={() => onAction(card.id, 'createDoc', { type: 'fact' })} style={{ border: '1px solid #d8d3cc', background: '#fff', color: '#3a352f', padding: '7px 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>📄 Счёт-фактура</button>
                <button onClick={() => onOpen(card.id)} style={{ border: '1px solid #e0dcd5', background: '#fff', color: '#6b655b', padding: '7px 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Открыть</button>
                <span style={{ flex: 1 }} />
                <button onClick={() => onAction(card.id, 'returnToAcc')} style={{ border: '1px solid #d8d3cc', background: '#fff', color: '#3a352f', padding: '7px 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>← В К Учёту</button>
                <button onClick={() => onAction(card.id, 'post1C')} style={{ background: card.posted1C ? '#e8f5ee' : '#fff', border: `1px solid ${card.posted1C ? '#a0d8b8' : '#d8d3cc'}`, color: card.posted1C ? '#2e8a5e' : '#3a352f', padding: '7px 13px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>
                  {card.posted1C ? '✓ Проведено в 1С' : 'Провести в 1С'}
                </button>
                {card.posted1C && <button onClick={() => onAction(card.id, 'sendArchive')} style={{ background: '#211f1c', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12 }}>В Архив →</button>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SettingsScreen({ data }: { data: Record<string, unknown> | null }) {
  const [tab, setTab] = useState<'clients' | 'users' | 'suppliers' | 'nom'>('clients')
  if (!data) return <div style={{ color: '#a39c92' }}>Загрузка…</div>
  const { clients, users, suppliers, nomenclature } = data as {
    clients: Array<{ id: string; name: string; slug: string; active: boolean }>
    users: Array<{ id: string; name: string; email: string; role: string; slug: string; active: boolean }>
    suppliers: Array<{ id: string; name: string; type: string; active: boolean }>
    nomenclature: Array<{ id: string; name: string; unit: string; cat: string }>
  }
  const tabs = [['clients', 'Заказчики', clients.length], ['users', 'Ответственные', users.length], ['suppliers', 'Поставщики', suppliers.length], ['nom', 'Номенклатура', nomenclature.length]] as const
  const hints: Record<string, string> = {
    clients: 'Личная ссылка ведёт в кабинет заказчика. Slug — параметр URL /client?id=slug',
    users: 'Ссылка RSP ведёт в портал ответственного. Генерируется для роли «Ответственный».',
    suppliers: 'Поставщики подставляются в позиции. «Центр Склад» включает складские операции.',
    nom: 'Справочник номенклатуры 1С — используется при конвертации устных заявок.',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 15, maxWidth: 1000, animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e6e2dc' }}>
        {tabs.map(([id, label, count]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '9px 14px', border: 'none', borderBottom: `2px solid ${tab === id ? '#d4613a' : 'transparent'}`, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: tab === id ? 700 : 500, color: tab === id ? '#26231f' : '#8a847c', marginBottom: -1 }}>
            {label} <span style={{ opacity: .55, fontFamily: 'JetBrains Mono, monospace' }}>{count}</span>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: '#8a847c' }}>{hints[tab]}</div>
      <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 11, overflow: 'hidden' }}>
        {tab === 'clients' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ background: '#faf8f6', borderBottom: '1px solid #eee8e1' }}>
              {['Название', 'Slug', 'Ссылка кабинета', 'Статус', ''].map(h => <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10.5, color: '#a39c92', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4 }}>{h}</th>)}
            </tr></thead>
            <tbody>{clients.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f4f1ec', opacity: c.active ? 1 : .5 }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{c.name}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', color: '#6b655b' }}>{c.slug}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', color: '#6b655b', fontSize: 11.5 }}>/client?id={c.slug}</td>
                <td style={{ padding: '12px 16px' }}><span style={{ color: c.active ? '#2e8a5e' : '#b8b1a6', fontWeight: 500 }}>{c.active ? 'Активен' : 'Неактивен'}</span></td>
                <td style={{ padding: '12px 16px' }}><button onClick={() => { try { navigator.clipboard.writeText(`${window.location.origin}/client?id=${c.slug}`) } catch {} }} style={{ border: '1px solid #e0dcd5', background: '#fff', color: '#6b655b', padding: '6px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600 }}>📋 Копировать ссылку</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {tab === 'users' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ background: '#faf8f6', borderBottom: '1px solid #eee8e1' }}>
              {['Имя', 'Email', 'Роль', 'Slug', 'Статус'].map(h => <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10.5, color: '#a39c92', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4 }}>{h}</th>)}
            </tr></thead>
            <tbody>{users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f4f1ec', opacity: u.active ? 1 : .5 }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{u.name}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', color: '#6b655b', fontSize: 11.5 }}>{u.email}</td>
                <td style={{ padding: '12px 16px', color: '#6b655b' }}>{u.role}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', color: '#6b655b' }}>{u.slug || '—'}</td>
                <td style={{ padding: '12px 16px' }}><span style={{ color: u.active ? '#2e8a5e' : '#b8b1a6', fontWeight: 500 }}>{u.active ? 'Активен' : 'Неактивен'}</span></td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {tab === 'suppliers' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ background: '#faf8f6', borderBottom: '1px solid #eee8e1' }}>
              {['Название', 'Тип', 'Статус'].map(h => <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10.5, color: '#a39c92', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4 }}>{h}</th>)}
            </tr></thead>
            <tbody>{suppliers.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f4f1ec', opacity: s.active ? 1 : .5 }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{s.name}</td>
                <td style={{ padding: '12px 16px', color: '#6b655b' }}>{s.type}</td>
                <td style={{ padding: '12px 16px' }}><span style={{ color: s.active ? '#2e8a5e' : '#b8b1a6', fontWeight: 500 }}>{s.active ? 'Активен' : 'Неактивен'}</span></td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {tab === 'nom' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ background: '#faf8f6', borderBottom: '1px solid #eee8e1' }}>
              {['Наименование 1С', 'Ед.', 'Категория'].map(h => <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10.5, color: '#a39c92', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4 }}>{h}</th>)}
            </tr></thead>
            <tbody>{nomenclature.map(n => (
              <tr key={n.id} style={{ borderBottom: '1px solid #f4f1ec' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{n.name}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', color: '#6b655b' }}>{n.unit}</td>
                <td style={{ padding: '12px 16px', color: '#8a847c' }}>{n.cat}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Main AdminApp ─────────────────────────────────────────────────────────────

export default function AdminApp({ user }: { user: SessionUser }) {
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [incTab, setIncTab] = useState<IncTab>('new')
  const [orders, setOrders] = useState<Order[]>([])
  const [dashData, setDashData] = useState<Record<string, unknown> | null>(null)
  const [settingsData, setSettingsData] = useState<Record<string, unknown> | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 2400)
  }, [])

  const loadOrders = useCallback(async () => {
    try { setOrders(await fetchAllOrders()) } catch { showToast('Ошибка загрузки') }
  }, [showToast])

  const loadDash = useCallback(async () => {
    try { setDashData(await fetchDashboard()) } catch {}
  }, [])

  const loadSettings = useCallback(async () => {
    try { setSettingsData(await fetchSettings()) } catch {}
  }, [])

  useEffect(() => {
    Promise.all([loadOrders(), loadDash()]).finally(() => setLoading(false))
  }, [loadOrders, loadDash])

  useEffect(() => {
    if (screen === 'settings' && !settingsData) loadSettings()
    if (screen === 'dashboard') loadDash()
  }, [screen, settingsData, loadSettings, loadDash])

  const handleAction = useCallback(async (id: string, action: string, payload?: Record<string, unknown>) => {
    try {
      const updated = await orderAction(id, action, payload)
      setOrders(prev => prev.map(o => o.id === id ? updated : o))
      const msgs: Record<string, string> = {
        accept: `✓ ${id} → Приёмка`, take: `✓ ${id} → Стол приёмки`, process: `✓ ${id} → Исходящие`,
        markAll: `✓ ${id} — все доставлены`, sendAcc: `✓ ${id} → К учёту`, postAcc: `✓ ${id} → Бухгалтерия`,
        returnOut: `${id} → Входящие`, returnToAcc: `${id} → К учёту`, cancel: `${id} отменён`,
        restore: `${id} восстановлен`, confirmChg: `✓ Изменение принято`, postpone: `${id} — статус изменён`,
        createDoc: `✓ Документ создан`, post1C: `✓ ${id} проведён в 1С`, sendArchive: `✓ ${id} → Архив`,
        updatePos: `✓ Позиция обновлена`,
      }
      showToast(msgs[action] || `✓ ${action}`)
      loadDash()
    } catch (e) { showToast(`Ошибка: ${(e as Error).message}`) }
  }, [showToast, loadDash])

  const handlePostAll = useCallback(async () => {
    try { const { count } = await postAll(); await loadOrders(); await loadDash(); showToast(`✓ Проведено: ${count}`) } catch { showToast('Ошибка') }
  }, [loadOrders, loadDash, showToast])

  // Computed badges
  const inc = orders.filter(o => o.screen === 'incoming')
  const newCards = inc.filter(o => !o.isDraft && !o.isCancelled && !o.toacc)
  const changed = orders.filter(o => o.isChanged && !o.isCancelled && !o.isDraft)
  const reception = orders.filter(o => o.screen === 'reception')
  const outgoing = orders.filter(o => o.screen === 'outgoing' && o.status === 'В работе')
  const accounting = orders.filter(o => o.screen === 'accounting')
  const bookkeeping = orders.filter(o => o.screen === 'bookkeeping')
  const toaccCount = inc.filter(o => o.toacc).length + accounting.length

  const navItems = [
    { id: 'dashboard', label: 'Дашборд', badge: 0 },
    { id: 'reception', label: 'Приёмка', badge: reception.length },
    { id: 'incoming', label: 'Входящие', badge: newCards.length + changed.length },
    { id: 'outgoing', label: 'Исходящие', badge: outgoing.length },
    { id: 'filter', label: 'Фильтр', badge: 0 },
    { id: 'accounting', label: 'К Учёту', badge: accounting.length },
    { id: 'warehouse', label: 'Склад', badge: 0, disabled: true },
    { id: 'bookkeeping', label: 'Бухгалтерия', badge: bookkeeping.length },
    { id: 'settings', label: 'Настройки', badge: 0 },
  ] as const

  const titles: Record<string, [string, string]> = {
    dashboard: ['Дашборд', 'Сводка по системе U-Kan'],
    reception: ['Приёмка', 'Обработка и подготовка заказов'],
    incoming: ['Входящие', 'Приём и сортировка заявок'],
    outgoing: ['Исходящие', 'Активное исполнение'],
    filter: ['Фильтр', 'Канбан по заказчикам и поставщикам'],
    accounting: ['К Учёту', 'Проверка перед бухгалтерией'],
    warehouse: ['Склад', ''],
    bookkeeping: ['Бухгалтерия', ''],
    settings: ['Настройки', 'Справочники, заказчики и ссылки доступа'],
    archive: ['Архив', 'Завершённые заказы'],
  }
  const [title, subtitle] = titles[screen] || ['', '']
  const detailOrder = orders.find(o => o.id === detailId) || null

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', fontSize: 13, fontFamily: "'Golos Text', system-ui, sans-serif" }}>
      {/* SIDEBAR */}
      <aside style={{ width: 230, flexShrink: 0, background: '#211f1c', color: '#cfc9c0', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '20px 22px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #322f2b' }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: '#d4613a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 15 }}>U</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: -.2 }}>U-Kan</div>
            <div style={{ fontSize: 10.5, color: '#8c857a', letterSpacing: .3 }}>ЛОГИСТИКА · АДМИН</div>
          </div>
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => {
            const active = item.id === screen
            const disabled = 'disabled' in item && item.disabled
            return (
              <button key={item.id} onClick={() => !disabled && setScreen(item.id as Screen)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 600 : 500, textAlign: 'left', background: active ? '#d4613a' : 'transparent', color: active ? '#fff' : disabled ? '#6b655b' : '#cfc9c0' }}>
                <span style={{ width: 3, height: 15, borderRadius: 2, background: active ? 'rgba(255,255,255,.55)' : 'transparent', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge > 0 && !disabled && <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', padding: '1px 7px', borderRadius: 20, background: active ? 'rgba(255,255,255,.22)' : '#3a3631', color: active ? '#fff' : '#cfc9c0' }}>{item.badge}</span>}
                {disabled && <span style={{ fontSize: 9, color: '#6b655b' }}>скоро</span>}
              </button>
            )
          })}
        </nav>
        <div style={{ padding: '14px 18px', borderTop: '1px solid #322f2b', fontSize: 11, color: '#8c857a' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <a href="/track" style={{ color: '#bdb7ae', textDecoration: 'none', borderBottom: '1px dotted #5a554d' }}>Трекинг</a>
          </div>
          <div style={{ marginBottom: 6 }}>{user.name}</div>
          <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8c857a', fontFamily: 'inherit', fontSize: 11, padding: 0, textDecoration: 'underline' }}>Выйти</button>
          <div style={{ marginTop: 6 }}>Версия 1.0 · 18.06.2026</div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
        {/* TOPBAR */}
        <header style={{ flexShrink: 0, height: 60, background: '#fff', borderBottom: '1px solid #e6e2dc', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -.3 }}>{title}</div>
            <div style={{ fontSize: 11.5, color: '#8a847c' }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Активных', value: orders.filter(o => !o.isDraft && !o.isCancelled).length, color: '#4a5aaa', bg: '#eef2ff' },
              { label: 'В работе', value: outgoing.length, color: '#c0532a', bg: '#fff0ea' },
              { label: 'Просрочено', value: orders.filter(o => isOverdue(o)).length, color: '#b03020', bg: '#faeaea' },
              { label: 'К учёту', value: toaccCount, color: '#2e8a5e', bg: '#e8f5ee' },
            ].map(p => (
              <div key={p.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 62, padding: '5px 12px', borderRadius: 9, background: p.bg, color: p.color }}>
                <span style={{ fontWeight: 700, fontSize: 15, fontFamily: 'JetBrains Mono, monospace' }}>{p.value}</span>
                <span style={{ fontSize: 10.5, opacity: .85 }}>{p.label}</span>
              </div>
            ))}
          </div>
          <button onClick={async () => { setLoading(true); await Promise.all([loadOrders(), loadDash()]); setLoading(false); showToast('Данные обновлены') }} title="Обновить" style={{ width: 36, height: 36, flexShrink: 0, border: '1px solid #e0dcd5', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#6b655b', fontSize: 15 }}>
            {loading ? '…' : '⟳'}
          </button>
        </header>

        {/* CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px 60px' }}>
          {screen === 'dashboard' && <Dashboard data={dashData} onGo={setScreen} />}
          {screen === 'reception' && <Reception orders={orders} onAction={handleAction} onOpen={setDetailId} settings={settingsData} />}
          {screen === 'incoming' && <Incoming orders={orders} tab={incTab} setTab={setIncTab} onAction={handleAction} onOpen={setDetailId} />}
          {screen === 'outgoing' && <Outgoing orders={orders} onAction={handleAction} onOpen={setDetailId} />}
          {screen === 'filter' && <FilterKanban orders={orders} onOpen={setDetailId} />}
          {screen === 'accounting' && <Accounting orders={orders} onAction={handleAction} onOpen={setDetailId} onPostAll={handlePostAll} />}
          {screen === 'bookkeeping' && <Bookkeeping orders={orders} onAction={handleAction} onOpen={setDetailId} />}
          {screen === 'settings' && <SettingsScreen data={settingsData} />}
          {(screen === 'warehouse' || screen === 'archive') && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', color: '#a39c92', animation: 'ukfade .25s' }}>
              <div style={{ width: 54, height: 54, borderRadius: 12, background: '#e6e2dc', marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#6b655b' }}>{title}</div>
              <div style={{ fontSize: 13, maxWidth: 380, marginTop: 6 }}>Экран вне текущего объёма ТЗ. Будет реализован по отдельному документу.</div>
            </div>
          )}
        </div>
      </div>

      {detailId && detailOrder && <DetailModal order={detailOrder} onClose={() => setDetailId(null)} onAction={handleAction} />}
      {toast && <Toast msg={toast} />}
    </div>
  )
}
