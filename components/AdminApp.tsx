'use client'
// components/AdminApp.tsx

import { useState, useEffect, useCallback } from 'react'
import { SessionUser, Order, Screen, IncTab } from '@/lib/types'
import { fetchAllOrders, fetchDashboard, fetchSettings, orderAction, postAll, logout, createOrder } from '@/lib/api'
import {
  cardProgress, cardSum, isOverdue, primaryResp,
  srcLabel, srcStyle, statusTag, barColor, fmtMoney, fmtDate, fmtDateTime, posPct
} from '@/lib/display'

// ─── Small UI pieces ─────────────────────────────────────────────────────────

function Tag({ status }: { status: string }) {
  const t = statusTag(status)
  return <span style={parseStyle(t.style)}>{t.label}</span>
}

function SrcTag({ source }: { source: string }) {
  return <span style={parseStyle(srcStyle(source))}>{srcLabel(source)}</span>
}

function Progress({ pct, h = 5 }: { pct: number; h?: number }) {
  return (
    <div style={{ height: h, background: '#ece8e2', borderRadius: h }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: h, background: barColor(pct), transition: 'width .3s' }} />
    </div>
  )
}

function Chip({ on, label }: { on: boolean; label: string }) {
  const s = on
    ? 'color:#2e8a5e;background:#e8f5ee'
    : 'color:#a39c92;background:#f1ede7'
  return <span style={{ fontSize: 10.5, padding: '2px 9px', borderRadius: 20, fontWeight: 600, ...(parseStyle(s)) }}>{(on ? '✓ ' : '') + label}</span>
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

// ─── Card component ───────────────────────────────────────────────────────────

function Card({
  order, onAction, onOpen,
  showAccept, showTake, showProcess,
  showMarkAll, showSendAcc, showPostAcc,
  showReturnOut, showCancel, showRestore, showConfirmChg,
  showToArchive, showPost1C, showCreateDoc,
}: {
  order: Order
  onAction: (id: string, action: string, payload?: Record<string, unknown>) => void
  onOpen: (id: string) => void
  showAccept?: boolean
  showTake?: boolean
  showProcess?: boolean
  showMarkAll?: boolean
  showSendAcc?: boolean
  showPostAcc?: boolean
  showReturnOut?: boolean
  showCancel?: boolean
  showRestore?: boolean
  showConfirmChg?: boolean
  showToArchive?: boolean
  showPost1C?: boolean
  showCreateDoc?: boolean
}) {
  const prog = cardProgress(order)
  const sum = cardSum(order)
  const overdue = isOverdue(order)
  const st = statusTag(order.status)
  const borderColor = overdue ? '#e8a0a0' : '#e6e2dc'
  const allDone = order.positions.length > 0 && order.positions.every(p => p.status === 'Доставлено')

  return (
    <div
      style={{
        background: '#fff', border: `1px solid ${borderColor}`,
        borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
        opacity: order.postponed ? .6 : 1, animation: 'ukfade .2s',
        transition: 'box-shadow .15s',
      }}
      onClick={() => onOpen(order.id)}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.07)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-.3px' }}>
            {order.id}
          </div>
          <div style={{ fontSize: 12, color: '#8a847c', marginTop: 2 }}>
            {order.from} → {order.to || '—'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={parseStyle(st.style)}>{st.label}</span>
          <SrcTag source={order.source} />
        </div>
      </div>

      {/* Changed banner */}
      {order.isChanged && (
        <div style={{ background: '#fdf8e1', border: '1px solid #e8d87a', borderRadius: 7, padding: '8px 11px', marginBottom: 8, fontSize: 12 }}>
          <div style={{ fontWeight: 600, color: 'oklch(0.5 0.12 70)', marginBottom: 2 }}>⚠ Клиент изменил заказ</div>
          <div style={{ color: '#5a554d' }}>{order.changeText}</div>
          {order.changePhone && <div style={{ color: '#8a847c', marginTop: 2 }}>{order.changePhone}</div>}
        </div>
      )}

      {/* Comment/positions preview */}
      {order.comment && order.positions.length === 0 && (
        <div style={{ fontSize: 12, color: '#6b655b', background: '#faf8f6', borderRadius: 7, padding: '7px 10px', marginBottom: 8, whiteSpace: 'pre-line' }}>
          {order.comment.slice(0, 120)}{order.comment.length > 120 ? '…' : ''}
        </div>
      )}

      {/* Positions */}
      {order.positions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {order.positions.slice(0, 3).map(p => {
            const ps = statusTag(p.status || 'В работе')
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ flex: 1, color: '#26231f', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name1c || p.oral || '—'}
                </span>
                <span style={parseStyle(ps.style)}>{ps.label}</span>
                {p.late && <span style={{ fontSize: 10, color: '#c0392b', fontWeight: 600 }}>⚠</span>}
              </div>
            )
          })}
          {order.positions.length > 3 && (
            <div style={{ fontSize: 11, color: '#a39c92' }}>+ ещё {order.positions.length - 3} позиций</div>
          )}
        </div>
      )}

      {/* Progress bar */}
      {order.positions.length > 0 && <div style={{ marginBottom: 10 }}><Progress pct={prog} /></div>}

      {/* Meta */}
      <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: '#a39c92', marginBottom: 10, flexWrap: 'wrap' }}>
        <span>{fmtDateTime(order.createdAt)}</span>
        {order.deadline && <span style={{ color: overdue ? '#c0392b' : '#a39c92' }}>срок: {fmtDate(order.deadline)}</span>}
        {sum > 0 && <span style={{ fontWeight: 600, color: '#6b655b' }}>{fmtMoney(sum)}</span>}
        {order.positions.length > 0 && <span>{primaryResp(order)}</span>}
        {order.postponed && <span style={{ color: 'oklch(0.5 0.1 250)' }}>⏸ Отложено</span>}
        {order.phone && <span>{order.phone}</span>}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
        {showAccept && (
          <Btn onClick={() => onAction(order.id, 'accept')} primary>Принять →</Btn>
        )}
        {showTake && (
          <Btn onClick={() => onAction(order.id, 'take')} primary>Взять в работу</Btn>
        )}
        {showProcess && (
          <Btn onClick={() => onAction(order.id, 'process')} primary>→ Исходящие</Btn>
        )}
        {showMarkAll && !allDone && (
          <Btn onClick={() => onAction(order.id, 'markAll')} primary>✓ Всё доставлено</Btn>
        )}
        {showSendAcc && (
          <Btn onClick={() => onAction(order.id, 'sendAcc')}>К учёту →</Btn>
        )}
        {showPostAcc && (
          <Btn onClick={() => onAction(order.id, 'postAcc')} primary>→ Бухгалтерия</Btn>
        )}
        {showReturnOut && (
          <Btn onClick={() => onAction(order.id, 'returnOut')}>← Вернуть</Btn>
        )}
        {showConfirmChg && order.isChanged && (
          <Btn onClick={() => onAction(order.id, 'confirmChg')} color="70">✓ Принять изменение</Btn>
        )}
        {showCancel && (
          <Btn onClick={() => onAction(order.id, 'cancel')} color="25">Отменить</Btn>
        )}
        {showRestore && (
          <Btn onClick={() => onAction(order.id, 'restore')}>Восстановить</Btn>
        )}
        {showPost1C && !order.posted1C && (
          <Btn onClick={() => onAction(order.id, 'post1C')} primary>Провести в 1С</Btn>
        )}
        {showCreateDoc && !order.invoice && (
          <Btn onClick={() => onAction(order.id, 'createDoc', { type: 'invoice' })}>Счёт</Btn>
        )}
        {showCreateDoc && !order.fact && (
          <Btn onClick={() => onAction(order.id, 'createDoc', { type: 'fact' })}>Счёт-фактура</Btn>
        )}
        {showToArchive && order.posted1C && (
          <Btn onClick={() => onAction(order.id, 'sendArchive')} color="260">→ Архив</Btn>
        )}
        <Btn onClick={() => onAction(order.id, 'postpone')} small>
          {order.postponed ? '▶ Снять паузу' : '⏸'}
        </Btn>
      </div>
    </div>
  )
}

function Btn({ children, onClick, primary, color, small }: {
  children: React.ReactNode
  onClick: () => void
  primary?: boolean
  color?: string
  small?: boolean
}) {
  const h = color || (primary ? '30' : '260')
  const bg = primary ? `#d4613a` : `oklch-soft3(${h})`
  const fg = primary ? '#fff' : `oklch(0.45 0.1 ${h})`
  const border = primary ? 'transparent' : `oklch(0.85 0.05 ${h})`
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '4px 10px' : '6px 13px',
        fontSize: small ? 11 : 12,
        fontWeight: 600, border: `1px solid ${border}`,
        borderRadius: 8, cursor: 'pointer', background: bg, color: fg,
        fontFamily: 'inherit', transition: 'opacity .15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '.8')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {children}
    </button>
  )
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

function DetailModal({ order, onClose, onAction }: {
  order: Order
  onClose: () => void
  onAction: (id: string, action: string, payload?: Record<string, unknown>) => void
}) {
  const prog = cardProgress(order)
  const sum = cardSum(order)
  const st = statusTag(order.status)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/track?id=${order.id}` : order.trackingLink

  function copyLink() {
    try { navigator.clipboard.writeText(url) } catch {}
  }

  const posStatuses = ['В работе', 'Готово к отгрузке', 'В пути', 'Доставлено']

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.38)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '88vh', overflow: 'auto', padding: 28, animation: 'ukpop .18s' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 19, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-.3px' }}>{order.id}</div>
            <div style={{ fontSize: 13, color: '#8a847c', marginTop: 3 }}>{order.from} → {order.to || '—'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={parseStyle(st.style)}>{st.label}</span>
            <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e6e2dc', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, color: '#8a847c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18, fontSize: 12.5 }}>
          {[
            ['Источник', srcLabel(order.source)],
            ['Создан', fmtDateTime(order.createdAt)],
            ['Срок', fmtDate(order.deadline)],
            ['Доставлен', fmtDate(order.delivered)],
            ['Сумма', fmtMoney(sum)],
            ['Ответственный', primaryResp(order)],
          ].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: '#a39c92', marginBottom: 2 }}>{label}</div>
              <div style={{ fontWeight: 500 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Progress */}
        {order.positions.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
              <span style={{ fontWeight: 600 }}>Прогресс</span>
              <span style={{ color: '#8a847c' }}>{prog}%</span>
            </div>
            <Progress pct={prog} h={7} />
          </div>
        )}

        {/* Comment */}
        {order.comment && (
          <div style={{ background: '#faf8f6', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, whiteSpace: 'pre-line', color: '#3a352f' }}>
            {order.comment}
          </div>
        )}

        {/* Positions */}
        {order.positions.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>Позиции</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {order.positions.map((p, i) => (
                <div key={p.id} style={{ background: '#faf8f6', borderRadius: 9, padding: '10px 12px', border: '1px solid #ece8e2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{i + 1}. {p.name1c || p.oral || '—'}</div>
                    {p.late && p.status !== 'Доставлено' && (
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, fontWeight: 600, color: '#b03020', background: '#faeaea' }}>⚠ Просрочено</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#8a847c', marginBottom: 7 }}>
                    {p.qty} {p.unit} · {p.resp || '—'}{p.supplier ? ' · ' + p.supplier : ''} · {fmtMoney(p.qty * p.price)}
                  </div>
                  <div style={{ marginBottom: 6 }}><Progress pct={posPct(p)} h={4} /></div>
                  {order.screen === 'outgoing' && (
                    <select
                      value={p.status}
                      onChange={e => { e.stopPropagation(); onAction(order.id, 'updatePos', { posId: p.id, status: e.target.value }) }}
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: 11.5, padding: '4px 8px', border: '1px solid #d8d3cc', borderRadius: 7, background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}
                    >
                      {posStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tracking link */}
        <div style={{ background: '#f7f5f2', borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 12 }}>
          <span style={{ flex: 1, color: '#6b655b', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
          <button
            onClick={copyLink}
            style={{ padding: '5px 12px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >Копировать</button>
        </div>

        {/* Changed */}
        {order.isChanged && (
          <div style={{ background: '#fdf8e1', border: '1px solid #e8d87a', borderRadius: 9, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: 'oklch(0.5 0.12 70)', marginBottom: 4 }}>Клиент изменил заказ</div>
            <div style={{ fontSize: 13 }}>{order.changeText}</div>
            {order.changePhone && <div style={{ fontSize: 12, color: '#8a847c', marginTop: 4 }}>{order.changePhone}</div>}
          </div>
        )}

        {/* Doc chips */}
        {order.screen === 'bookkeeping' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <Chip on={order.invoice} label="Счёт на оплату" />
            <Chip on={order.fact} label="Счёт-фактура" />
            <Chip on={order.posted1C} label="Проведено в 1С" />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return (
    <div style={{
      position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
      background: '#211f1c', color: '#fff', padding: '11px 22px', borderRadius: 10,
      fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,.22)',
      animation: 'uktoast .2s', zIndex: 200, whiteSpace: 'nowrap',
    }}>
      {message}
    </div>
  )
}

// ─── Screens ──────────────────────────────────────────────────────────────────

function Dashboard({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <div style={{ padding: 40, color: '#8a847c', textAlign: 'center' }}>Загрузка…</div>
  const { kpi, flow, progress, attention, activity, topClients } = data as {
    kpi: Record<string, number>
    flow: Record<string, number>
    progress: Record<string, number>
    attention: Array<{ label: string; sub: string; tag: string; hue: string }>
    activity: Array<{ text: string; sub: string; time: string; userName: string }>
    topClients: Array<{ name: string; count: number; pct: number }>
  }

  const pill = (value: number, label: string, hue: string) => (
    <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 68, padding: '7px 14px', borderRadius: 10, background: `oklch-soft2(${hue})`, color: `oklch(0.45 0.1 ${hue})` }}>
      <span style={{ fontWeight: 700, fontSize: 16, fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
      <span style={{ fontSize: 10.5, opacity: .85 }}>{label}</span>
    </div>
  )

  const flowItems = [
    ['Входящие', flow.incoming, '250', 'incoming'],
    ['Приёмка', flow.reception, '30', 'reception'],
    ['Исходящие', flow.outgoing, '30', 'outgoing'],
    ['К учёту', flow.accounting, '155', 'accounting'],
    ['Бухгалтерия', flow.bookkeeping, '155', 'bookkeeping'],
    ['Архив', flow.archive, '260', 'archive'],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1320, animation: 'ukfade .25s' }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
        {[
          { label: 'Активных карточек', value: kpi.active, color: '#26231f' },
          { label: 'Сегодня доставлено', value: kpi.deliveredToday, color: '#2e8a5e' },
          { label: 'Просрочено', value: kpi.overdue, color: kpi.overdue ? '#c0392b' : '#26231f' },
          { label: 'В работе', value: kpi.inwork, color: '#c0532a' },
          { label: 'Оборот сегодня', value: kpi.turnoverToday, color: '#26231f' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: '15px 16px' }}>
            <div style={{ fontSize: 11.5, color: '#8a847c', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: k.color, letterSpacing: '-.5px' }}>
              {typeof k.value === 'number' && k.label.includes('Оборот') ? fmtMoney(k.value) : k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Mid row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr .9fr', gap: 14 }}>
        {/* Attention */}
        <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12 }}>⚠ Требуют внимания</div>
          {attention.length === 0 ? (
            <div style={{ color: '#a39c92', fontSize: 13 }}>Всё в порядке</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attention.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#faf8f6', border: '1px solid #ece8e2', borderRadius: 8, padding: '9px 11px' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: `rgb-hue(${a.hue})`, flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600 }}>{a.label}</span>
                    <span style={{ display: 'block', fontSize: 11, color: '#8a847c' }}>{a.sub}</span>
                  </span>
                  <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 20, fontWeight: 600, color: `oklch(0.48 0.12 ${a.hue})`, background: `oklch(0.95 0.05 ${a.hue})`, whiteSpace: 'nowrap' }}>{a.tag}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity */}
        <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12 }}>📋 Последние действия</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {activity.map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: 11, padding: '7px 0', borderBottom: '1px solid #f1ede7' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d4613a', marginTop: 5, flex: 'none' }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500 }}>{ev.text}</span>
                  <span style={{ display: 'block', fontSize: 11, color: '#a39c92' }}>{ev.sub}</span>
                </span>
                <span style={{ fontSize: 10.5, color: '#b8b1a6', whiteSpace: 'nowrap' }}>{fmtDateTime(ev.time)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress ring */}
        <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, alignSelf: 'flex-start', marginBottom: 8 }}>Прогресс системы</div>
          <div style={{ position: 'relative', width: 130, height: 130, borderRadius: '50%', background: `conic-gradient(#d4613a ${(progress.overallPct || 0) * 3.6}deg, #ece8e2 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px 0 14px' }}>
            <div style={{ width: 98, height: 98, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{progress.overallPct || 0}%</span>
              <span style={{ fontSize: 11, color: '#8a847c' }}>средний %</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b655b' }}>
            <span><b style={{ color: '#d4613a' }}>{progress.inwork}</b> в работе</span>
            <span><b style={{ color: '#3a9d6e' }}>{progress.delivered}</b> доставлено</span>
            <span><b style={{ color: 'oklch(0.55 0.18 25)' }}>{progress.overdue}</b> просроч.</span>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
        {/* Flow */}
        <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 14 }}>🔄 Поток карточек</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {flowItems.map(([label, value, hue], i) => (
              <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: `oklch(0.5 0.12 ${hue})` }}>{value as number}</div>
                  <div style={{ fontSize: 11, color: '#a39c92' }}>{label as string}</div>
                </div>
                {i < flowItems.length - 1 && <span style={{ color: '#d8d3cc', fontSize: 18 }}>→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Top clients */}
        <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12 }}>🏆 Топ заказчики</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topClients.map(c => (
              <div key={c.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{c.name}</span>
                  <span style={{ color: '#8a847c', fontFamily: 'JetBrains Mono, monospace' }}>{c.count}</span>
                </div>
                <div style={{ height: 5, background: '#ece8e2', borderRadius: 3 }}>
                  <div style={{ width: `${c.pct}%`, height: '100%', borderRadius: 3, background: '#d4613a' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pills summary */}
      <div style={{ display: 'flex', gap: 10 }}>
        {pill(kpi.active, 'Активных', '260')}
        {pill(kpi.inwork, 'В работе', '30')}
        {pill(kpi.overdue, 'Просрочено', '25')}
        {pill(kpi.toacc, 'К учёту', '155')}
      </div>
    </div>
  )
}

function Reception({ orders, onAction, onOpen }: { orders: Order[]; onAction: (id: string, a: string, p?: Record<string, unknown>) => void; onOpen: (id: string) => void }) {
  const waiting = orders.filter(o => o.screen === 'reception' && o.block === 'waiting')
  const processing = orders.filter(o => o.screen === 'reception' && o.block === 'processing')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, animation: 'ukfade .22s' }}>
      {/* Ожидание */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
          Ожидание
          <span style={{ fontSize: 11.5, fontWeight: 600, padding: '1px 9px', borderRadius: 20, background: '#fdf0ea', color: '#c0532a', fontFamily: 'JetBrains Mono, monospace' }}>{waiting.length}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {waiting.length === 0 ? <EmptyState text="Заказы ожидают поступления" /> :
            waiting.map(o => <Card key={o.id} order={o} onAction={onAction} onOpen={onOpen} showTake showReturnOut showCancel />)}
        </div>
      </div>

      {/* Стол приёмки */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
          Стол приёмки
          <span style={{ fontSize: 11.5, fontWeight: 600, padding: '1px 9px', borderRadius: 20, background: '#fdf0ea', color: '#c0532a', fontFamily: 'JetBrains Mono, monospace' }}>{processing.length}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {processing.length === 0 ? <EmptyState text="Стол свободен" /> :
            processing.map(o => <Card key={o.id} order={o} onAction={onAction} onOpen={onOpen} showProcess showCancel />)}
        </div>
      </div>
    </div>
  )
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

  const tabs: [IncTab, string, Order[]][] = [
    ['new', 'Новые', newCards],
    ['changed', 'Изменённые', changed],
    ['toacc', 'К учёту', toacc],
    ['drafts', 'Черновики', drafts],
    ['cancelled', 'Отменённые', cancelled],
  ]

  const currentList = tabs.find(t => t[0] === tab)?.[2] || []

  return (
    <div style={{ animation: 'ukfade .22s' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #ece8e2', marginBottom: 20 }}>
        {tabs.map(([id, label, list]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: '9px 14px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: tab === id ? 700 : 500,
              color: tab === id ? '#26231f' : '#8a847c',
              background: 'none', borderBottom: `2px solid ${tab === id ? '#d4613a' : 'transparent'}`,
              marginBottom: -2,
            }}
          >
            {label}
            {list.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', padding: '0 6px', borderRadius: 20, background: tab === id ? 'oklch(0.94 0.05 30)' : '#f1ede7', color: tab === id ? '#c0532a' : '#8a847c' }}>
                {list.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {currentList.length === 0 ? <EmptyState text="Нет заказов в этой вкладке" /> :
          currentList.map(o => (
            <Card
              key={o.id} order={o} onAction={onAction} onOpen={onOpen}
              showAccept={tab === 'new'}
              showConfirmChg={tab === 'changed'}
              showSendAcc={tab === 'toacc'}
              showCancel={tab !== 'cancelled' && tab !== 'toacc'}
              showRestore={tab === 'cancelled'}
            />
          ))
        }
      </div>
    </div>
  )
}

function Outgoing({ orders, onAction, onOpen }: { orders: Order[]; onAction: (id: string, a: string, p?: Record<string, unknown>) => void; onOpen: (id: string) => void }) {
  const cards = orders.filter(o => o.screen === 'outgoing' && o.status === 'В работе')

  return (
    <div style={{ animation: 'ukfade .22s' }}>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#8a847c' }}>
        Активных заказов: <b style={{ color: '#26231f' }}>{cards.length}</b>
        {cards.filter(o => isOverdue(o)).length > 0 && (
          <span style={{ marginLeft: 12, color: '#c0392b', fontWeight: 600 }}>
            ⚠ Просрочено: {cards.filter(o => isOverdue(o)).length}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {cards.length === 0 ? <EmptyState text="Активных заказов нет" /> :
          cards.map(o => (
            <Card key={o.id} order={o} onAction={onAction} onOpen={onOpen}
              showMarkAll showReturnOut showCancel showConfirmChg />
          ))
        }
      </div>
    </div>
  )
}

function Accounting({ orders, onAction, onOpen, onPostAll }: {
  orders: Order[]
  onAction: (id: string, a: string, p?: Record<string, unknown>) => void
  onOpen: (id: string) => void
  onPostAll: () => void
}) {
  const cards = orders.filter(o => o.screen === 'accounting' && o.status === 'К учёту')

  return (
    <div style={{ animation: 'ukfade .22s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#8a847c' }}>На проверке: <b style={{ color: '#26231f' }}>{cards.length}</b></span>
        {cards.length > 1 && (
          <button onClick={onPostAll} style={{ padding: '7px 16px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
            Провести все в бухгалтерию ({cards.filter(o => !o.postponed).length})
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {cards.length === 0 ? <EmptyState text="Нет заказов на проверке" /> :
          cards.map(o => <Card key={o.id} order={o} onAction={onAction} onOpen={onOpen} showPostAcc showReturnOut />)}
      </div>
    </div>
  )
}

function Bookkeeping({ orders, onAction, onOpen }: { orders: Order[]; onAction: (id: string, a: string, p?: Record<string, unknown>) => void; onOpen: (id: string) => void }) {
  const cards = orders.filter(o => o.screen === 'bookkeeping')
  const posted = cards.filter(o => o.posted1C).length

  return (
    <div style={{ animation: 'ukfade .22s' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'На учёте', value: cards.length, hue: '155' },
          { label: 'Проведено в 1С', value: posted, hue: '155' },
          { label: 'Ожидают', value: cards.length - posted, hue: '260' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 9, padding: '10px 16px', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 20, fontFamily: 'JetBrains Mono, monospace', color: `oklch(0.5 0.12 ${k.hue})` }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: '#a39c92' }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {cards.length === 0 ? <EmptyState text="Нет карточек в бухгалтерии" /> :
          cards.map(o => <Card key={o.id} order={o} onAction={onAction} onOpen={onOpen}
            showPost1C showCreateDoc showToArchive showReturnOut />)}
      </div>
    </div>
  )
}

function FilterKanban({ orders, onAction, onOpen }: { orders: Order[]; onAction: (id: string, a: string, p?: Record<string, unknown>) => void; onOpen: (id: string) => void }) {
  const board = orders.filter(o => !o.isDraft && !o.isCancelled && o.screen !== 'bookkeeping')
  const byClient: Record<string, Order[]> = {}
  board.forEach(o => { (byClient[o.from] = byClient[o.from] || []).push(o) })

  return (
    <div style={{ animation: 'ukfade .22s' }}>
      <div style={{ fontSize: 13, color: '#8a847c', marginBottom: 16 }}>
        Всего карточек: <b style={{ color: '#26231f' }}>{board.length}</b> · заказчиков: <b style={{ color: '#26231f' }}>{Object.keys(byClient).length}</b>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
        {Object.entries(byClient).map(([client, cards]) => (
          <div key={client}>
            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              {client}
              <span style={{ fontSize: 11.5, fontWeight: 600, padding: '1px 8px', borderRadius: 20, background: '#f1ede7', color: '#6b655b', fontFamily: 'JetBrains Mono, monospace' }}>{cards.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cards.map(o => <Card key={o.id} order={o} onAction={onAction} onOpen={onOpen} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Settings({ data }: { data: Record<string, unknown> | null }) {
  const [tab, setTab] = useState<'clients' | 'users' | 'suppliers' | 'nom'>('clients')

  if (!data) return <div style={{ color: '#8a847c' }}>Загрузка…</div>
  const { clients, users, suppliers, nomenclature } = data as {
    clients: Array<{ id: string; name: string; slug: string; active: boolean }>
    users: Array<{ id: string; name: string; email: string; role: string; slug: string; active: boolean }>
    suppliers: Array<{ id: string; name: string; type: string; active: boolean }>
    nomenclature: Array<{ id: string; name: string; unit: string; cat: string }>
  }

  const tabs = [
    ['clients', 'Заказчики', clients.length],
    ['users', 'Ответственные', users.length],
    ['suppliers', 'Поставщики', suppliers.length],
    ['nom', 'Номенклатура', nomenclature.length],
  ] as const

  return (
    <div style={{ animation: 'ukfade .22s' }}>
      <div style={{ display: 'flex', borderBottom: '2px solid #ece8e2', marginBottom: 20 }}>
        {tabs.map(([id, label, count]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '9px 14px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: tab === id ? 700 : 500, color: tab === id ? '#26231f' : '#8a847c', background: 'none', borderBottom: `2px solid ${tab === id ? '#d4613a' : 'transparent'}`, marginBottom: -2 }}>
            {label} <span style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', color: '#a39c92' }}>{count}</span>
          </button>
        ))}
      </div>

      {tab === 'clients' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ece8e2' }}>
              {['Название', 'Slug', 'Ссылка кабинета', 'Статус'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11.5, color: '#8a847c', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f1ede7', opacity: c.active ? 1 : .5 }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{c.name}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', color: '#6b655b' }}>{c.slug}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', color: '#6b655b', fontSize: 11.5 }}>/client/{c.slug}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ color: c.active ? '#2e8a5e' : '#b8b1a6', fontWeight: 500 }}>{c.active ? 'Активен' : 'Неактивен'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'users' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ece8e2' }}>
              {['Имя', 'Email', 'Роль', 'Slug', 'Статус'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11.5, color: '#8a847c', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f1ede7', opacity: u.active ? 1 : .5 }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{u.name}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', color: '#6b655b', fontSize: 12 }}>{u.email}</td>
                <td style={{ padding: '10px 12px', color: '#6b655b' }}>{u.role}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', color: '#6b655b' }}>{u.slug || '—'}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ color: u.active ? '#2e8a5e' : '#b8b1a6', fontWeight: 500 }}>{u.active ? 'Активен' : 'Неактивен'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'suppliers' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ece8e2' }}>
              {['Название', 'Тип', 'Статус'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11.5, color: '#8a847c', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {suppliers.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f1ede7', opacity: s.active ? 1 : .5 }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{s.name}</td>
                <td style={{ padding: '10px 12px', color: '#6b655b' }}>{s.type}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ color: s.active ? '#2e8a5e' : '#b8b1a6', fontWeight: 500 }}>{s.active ? 'Активен' : 'Неактивен'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'nom' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ece8e2' }}>
              {['Наименование 1С', 'Ед.', 'Категория'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11.5, color: '#8a847c', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nomenclature.map(n => (
              <tr key={n.id} style={{ borderBottom: '1px solid #f1ede7' }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{n.name}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', color: '#6b655b' }}>{n.unit}</td>
                <td style={{ padding: '10px 12px', color: '#8a847c' }}>{n.cat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: '#a39c92', fontSize: 13 }}>{text}</div>
  )
}

// ─── Main AdminApp ────────────────────────────────────────────────────────────

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
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }, [])

  const loadOrders = useCallback(async () => {
    try {
      const data = await fetchAllOrders()
      setOrders(data)
    } catch (e) {
      showToast('Ошибка загрузки данных')
    }
  }, [showToast])

  const loadDashboard = useCallback(async () => {
    try {
      const data = await fetchDashboard()
      setDashData(data)
    } catch {}
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const data = await fetchSettings()
      setSettingsData(data)
    } catch {}
  }, [])

  useEffect(() => {
    Promise.all([loadOrders(), loadDashboard()]).finally(() => setLoading(false))
  }, [loadOrders, loadDashboard])

  useEffect(() => {
    if (screen === 'settings' && !settingsData) loadSettings()
    if (screen === 'dashboard') loadDashboard()
  }, [screen, settingsData, loadSettings, loadDashboard])

  const handleAction = useCallback(async (id: string, action: string, payload?: Record<string, unknown>) => {
    try {
      const updated = await orderAction(id, action, payload)
      setOrders(prev => prev.map(o => o.id === id ? updated : o))
      const messages: Record<string, string> = {
        accept: `✓ ${id} → Приёмка`,
        take: `✓ ${id} → Стол приёмки`,
        process: `✓ ${id} → Исходящие`,
        markAll: `✓ ${id} — все доставлены`,
        sendAcc: `✓ ${id} → К учёту`,
        postAcc: `✓ ${id} → Бухгалтерия`,
        returnOut: `${id} → Входящие`,
        returnToAcc: `${id} → К учёту`,
        cancel: `${id} отменён`,
        restore: `${id} восстановлен`,
        confirmChg: `✓ Изменение принято`,
        postpone: updated.postponed ? `${id} отложен` : `${id} — пауза снята`,
        createDoc: `✓ Документ создан`,
        post1C: `✓ ${id} проведён в 1С`,
        sendArchive: `✓ ${id} → Архив`,
        updatePos: `✓ Позиция обновлена`,
      }
      showToast(messages[action] || `✓ ${action}`)
      loadDashboard()
    } catch (e) {
      showToast(`Ошибка: ${(e as Error).message}`)
    }
  }, [showToast, loadDashboard])

  const handlePostAll = useCallback(async () => {
    try {
      const { count } = await postAll()
      await loadOrders()
      await loadDashboard()
      showToast(`✓ Проведено: ${count}`)
    } catch {
      showToast('Ошибка')
    }
  }, [loadOrders, loadDashboard, showToast])

  const handleRefresh = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadOrders(), loadDashboard()])
    setLoading(false)
    showToast('Данные обновлены')
  }, [loadOrders, loadDashboard, showToast])

  // Computed
  const incoming = orders.filter(o => o.screen === 'incoming')
  const newCards = incoming.filter(o => !o.isDraft && !o.isCancelled && !o.toacc)
  const changed = orders.filter(o => o.isChanged && !o.isCancelled && !o.isDraft)
  const reception = orders.filter(o => o.screen === 'reception')
  const outgoing = orders.filter(o => o.screen === 'outgoing' && o.status === 'В работе')
  const accounting = orders.filter(o => o.screen === 'accounting')
  const bookkeeping = orders.filter(o => o.screen === 'bookkeeping')

  const detailOrder = orders.find(o => o.id === detailId) || null

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

  const titles: Record<Screen, [string, string]> = {
    dashboard: ['Дашборд', 'Сводка по системе U-Kan'],
    reception: ['Приёмка', 'Обработка и подготовка заказов'],
    incoming: ['Входящие', 'Приём и сортировка заявок'],
    outgoing: ['Исходящие', 'Активное исполнение'],
    filter: ['Фильтр', 'Канбан по заказчикам'],
    accounting: ['К Учёту', 'Проверка перед бухгалтерией'],
    warehouse: ['Склад', 'Управление складом'],
    bookkeeping: ['Бухгалтерия', 'Финансовый учёт'],
    settings: ['Настройки', 'Справочники и доступы'],
    archive: ['Архив', 'Завершённые заказы'],
  }
  const [title, subtitle] = titles[screen] || ['', '']

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', fontSize: 13 }}>

      {/* SIDEBAR */}
      <aside style={{ width: 230, flex: 'none', background: '#211f1c', color: '#cfc9c0', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '20px 22px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #322f2b' }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: '#d4613a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 15 }}>U</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '-.2px' }}>U-Kan</div>
            <div style={{ fontSize: 10.5, color: '#8c857a', letterSpacing: '.3px' }}>ЛОГИСТИКА · АДМИН</div>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => {
            const active = item.id === screen
            const disabled = 'disabled' in item && item.disabled
            return (
              <button
                key={item.id}
                onClick={() => !disabled && setScreen(item.id as Screen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '9px 12px', border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 600 : 500, textAlign: 'left',
                  background: active ? '#d4613a' : 'transparent',
                  color: active ? '#fff' : disabled ? '#6b655b' : '#cfc9c0',
                  opacity: disabled ? .5 : 1,
                }}
              >
                <span style={{ width: 3, height: 15, borderRadius: 2, background: active ? 'rgba(255,255,255,.55)' : 'transparent' }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge > 0 && !disabled && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', padding: '1px 7px', borderRadius: 20, background: active ? 'rgba(255,255,255,.22)' : '#3a3631', color: active ? '#fff' : '#cfc9c0' }}>
                    {item.badge}
                  </span>
                )}
                {disabled && <span style={{ fontSize: 9, color: '#6b655b' }}>скоро</span>}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '14px 18px', borderTop: '1px solid #322f2b', fontSize: 11, color: '#8c857a' }}>
          <div style={{ marginBottom: 8 }}>{user.name}</div>
          <button
            onClick={logout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8c857a', fontFamily: 'inherit', fontSize: 11, padding: 0, textDecoration: 'underline' }}
          >
            Выйти
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>

        {/* TOPBAR */}
        <header style={{ flex: 'none', height: 60, background: '#fff', borderBottom: '1px solid #e6e2dc', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.3px' }}>{title}</div>
            <div style={{ fontSize: 11.5, color: '#8a847c' }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Активных', value: orders.filter(o => !o.isDraft && !o.isCancelled).length, hue: '260' },
              { label: 'В работе', value: outgoing.length, hue: '30' },
              { label: 'Просрочено', value: orders.filter(o => isOverdue(o)).length, hue: '25' },
              { label: 'К учёту', value: (incoming.filter(o => o.toacc).length) + accounting.length, hue: '155' },
            ].map(p => (
              <div key={p.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 62, padding: '5px 12px', borderRadius: 9, background: `oklch-soft2(${p.hue})`, color: `oklch(0.45 0.1 ${p.hue})` }}>
                <span style={{ fontWeight: 700, fontSize: 15, fontFamily: 'JetBrains Mono, monospace' }}>{p.value}</span>
                <span style={{ fontSize: 10.5, opacity: .85 }}>{p.label}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            title="Обновить"
            style={{ width: 36, height: 36, flex: 'none', border: '1px solid #e0dcd5', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#6b655b', fontSize: loading ? 12 : 15, fontWeight: loading ? 600 : 400 }}
          >
            {loading ? '…' : '⟳'}
          </button>
        </header>

        {/* CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px 60px' }}>
          {screen === 'dashboard' && <Dashboard data={dashData} />}
          {screen === 'reception' && <Reception orders={orders} onAction={handleAction} onOpen={setDetailId} />}
          {screen === 'incoming' && <Incoming orders={orders} tab={incTab} setTab={setIncTab} onAction={handleAction} onOpen={setDetailId} />}
          {screen === 'outgoing' && <Outgoing orders={orders} onAction={handleAction} onOpen={setDetailId} />}
          {screen === 'filter' && <FilterKanban orders={orders} onAction={handleAction} onOpen={setDetailId} />}
          {screen === 'accounting' && <Accounting orders={orders} onAction={handleAction} onOpen={setDetailId} onPostAll={handlePostAll} />}
          {screen === 'bookkeeping' && <Bookkeeping orders={orders} onAction={handleAction} onOpen={setDetailId} />}
          {screen === 'settings' && <Settings data={settingsData} />}
          {screen === 'warehouse' && (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#a39c92' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🏭</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Склад — скоро</div>
              <div>Этот модуль находится в разработке</div>
            </div>
          )}
        </div>
      </div>

      {/* DETAIL MODAL */}
      {detailId && detailOrder && (
        <DetailModal order={detailOrder} onClose={() => setDetailId(null)} onAction={handleAction} />
      )}

      {/* TOAST */}
      {toast && <Toast message={toast} />}
    </div>
  )
}
