'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// ─── ТИПЫ ───────────────────────────────────────────────────────────────────
interface Position {
  id: string; cardId: string; name1c: string; oral: string
  qty: number; unit: string; price: number; resp: string
  supplier: string; status: string; late: boolean; payment: string; deadline?: string
}
interface Order {
  id: string; from: string; fromId?: string; to: string
  screen: string; block: string; status: string; source: string
  comment: string; phone?: string; deadline?: string; delivered?: string
  isDraft: boolean; isChanged: boolean; changeText: string; changePhone: string
  isCancelled: boolean; cancelReason: string; toacc: boolean
  postponed: boolean; invoice?: boolean; fact?: boolean; posted1C: boolean
  cold: boolean; projectId?: string; specProjectId?: string; trackingLink?: string
  positions: Position[]; createdAt: string; sortOrder: number
}
interface User { id: string; name: string; phone?: string; email?: string; role: string; slug?: string; active: boolean }
interface Supplier { id: string; name: string; type: string; active: boolean }
interface Nomenclature { id: string; name: string; unit: string; cat: string }
interface Project { id: string; name: string }
interface SpecProject { id: string; name: string; status: string }
interface DashData { kpi: Record<string, number>; flow: Record<string, number>; progress: { overallPct: number }; attention: { label: string; sub: string; screen: string }[]; activity: { action: string; detail: string; cardId?: string; createdAt: string }[]; topClients: { name: string; count: number; pct: number }[]; specProjects: { id: string; name: string; pct: number; cardCount: number }[] }

// ─── УТИЛИТЫ ────────────────────────────────────────────────────────────────
const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''
const fmtDT = (d?: string | null) => d ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
const sum = (pos: Position[]) => pos.reduce((s, p) => s + p.qty * p.price, 0)
const fmtMoney = (n: number) => n.toLocaleString('ru-RU') + ' ₸'
const pctColor = (p: number) => p < 60 ? '#d4613a' : p < 100 ? '#c4a832' : '#3a9d6e'
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'В ожидании': { bg: '#eef2ff', color: '#4a5aaa' },
  'Принят': { bg: '#fff0ea', color: '#c0532a' },
  'В обработке': { bg: '#fff0ea', color: '#c0532a' },
  'В работе': { bg: '#fff0ea', color: '#c0532a' },
  'Готово к отгрузке': { bg: '#fdf8e1', color: '#8a6f00' },
  'В пути': { bg: '#fdf8e1', color: '#8a6f00' },
  'Доставлено': { bg: '#e8f5ee', color: '#2e8a5e' },
  'К учёту': { bg: '#e8f5ee', color: '#2e8a5e' },
  'Бухгалтерия': { bg: '#e8f5ee', color: '#2e8a5e' },
  'Отменён': { bg: '#faeaea', color: '#b03020' },
  'Черновик': { bg: '#efece8', color: '#6b655b' },
  'Новая заявка': { bg: '#eef2ff', color: '#4a5aaa' },
}
const sc = (s: string) => STATUS_COLORS[s] || { bg: '#f1efec', color: '#6b655b' }

const api = async (url: string, method = 'GET', body?: unknown) => {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error || 'Ошибка')
  return d
}

// ─── КОМПОНЕНТЫ ─────────────────────────────────────────────────────────────
const StatusBadge = ({ s }: { s: string }) => {
  const c = sc(s)
  return <span style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{s}</span>
}

const Progress = ({ pct }: { pct: number }) => (
  <div style={{ background: '#e8e3db', borderRadius: 4, height: 6, overflow: 'hidden', width: '100%' }}>
    <div style={{ width: `${pct}%`, height: '100%', background: pctColor(pct), borderRadius: 4, transition: 'width .3s' }} />
  </div>
)

const Modal = ({ onClose, title, children, wide }: { onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) => (
  <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: wide ? 900 : 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.18)', animation: 'ukpop .18s ease' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1efec', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
        <span style={{ fontWeight: 700, fontSize: 17, color: '#211f1c' }}>{title}</span>
        <button onClick={onClose} style={{ background: '#f1efec', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: '#6b655b' }}>×</button>
      </div>
      <div style={{ padding: '20px 24px' }}>{children}</div>
    </div>
  </div>
)

const Toast = ({ msg, onClose }: { msg: string; onClose: () => void }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#211f1c', color: '#fff', padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 500, zIndex: 2000, whiteSpace: 'nowrap', animation: 'uktoast .2s ease', boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
      {msg}
    </div>
  )
}

const Inp = ({ label, value, onChange, type = 'text', placeholder = '', required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 5 }}>{label}{required && ' *'}</label>
    <input value={value} onChange={e => onChange(e.target.value)} type={type} placeholder={placeholder}
      style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', color: '#26231f', outline: 'none', boxSizing: 'border-box' }} required={required} />
  </div>
)

// ─── КАРТОЧКА ЗАКАЗА ────────────────────────────────────────────────────────
const Card = ({ order, onClick, selected }: { order: Order; onClick: () => void; selected: boolean }) => {
  const totalPct = order.positions.length === 0 ? 0
    : Math.round(order.positions.reduce((s, p) => s + ({ 'В работе': 10, 'Готово к отгрузке': 60, 'В пути': 80, 'Доставлено': 100 }[p.status] || 0), 0) / order.positions.length)

  return (
    <div onClick={onClick} style={{
      background: selected ? '#fff8f5' : '#fff', border: selected ? '1.5px solid #d4613a' : '1px solid #e8e3db',
      borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'all .15s',
      marginBottom: 8, position: 'relative',
    }}>
      {order.isChanged && <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, background: '#d4613a', borderRadius: '50%' }} />}
      {order.postponed && <div style={{ position: 'absolute', top: 10, right: 24, fontSize: 12 }}>⏸</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, color: '#d4613a' }}>{order.id}</span>
        <StatusBadge s={order.status} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#211f1c', marginBottom: 2 }}>{order.from}</div>
      {order.to && <div style={{ fontSize: 12, color: '#9d9690' }}>→ {order.to}</div>}
      {order.positions.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 11, color: '#9d9690' }}>{order.positions.length} поз.</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: pctColor(totalPct) }}>{totalPct}%</span>
          </div>
          <Progress pct={totalPct} />
        </div>
      )}
      {order.deadline && <div style={{ fontSize: 11, color: '#9d9690', marginTop: 4 }}>⏰ {fmt(order.deadline)}</div>}
    </div>
  )
}

// ─── ДЕТАЛЬНАЯ ПАНЕЛЬ ───────────────────────────────────────────────────────
const POS_STATUSES = ['В работе', 'Готово к отгрузке', 'В пути', 'Доставлено']

const DetailPanel = ({
  order, onAction, onClose, settings,
}: {
  order: Order; onAction: (action: string, payload?: Record<string, unknown>) => void
  onClose: () => void; settings: { users: User[]; suppliers: Supplier[]; nomenclature: Nomenclature[] }
}) => {
  const [tab, setTab] = useState<'info' | 'pos' | 'hist'>('info')
  const [history, setHistory] = useState<{ action: string; detail: string; createdAt: string; userName: string }[]>([])
  const [cancReason, setCancReason] = useState('')
  const [showCanc, setShowCanc] = useState(false)

  useEffect(() => {
    if (tab === 'hist') {
      fetch(`/api/orders/${order.id}/history`).then(r => r.json()).then(setHistory)
    }
  }, [tab, order.id])

  const totalPct = order.positions.length === 0 ? 0
    : Math.round(order.positions.reduce((s, p) => s + ({ 'В работе': 10, 'Готово к отгрузке': 60, 'В пути': 80, 'Доставлено': 100 }[p.status] || 0), 0) / order.positions.length)

  const ACTIONS: Record<string, { label: string; action: string; color?: string }[]> = {
    incoming: [
      { label: '✓ Принять', action: 'accept', color: '#3a9d6e' },
      { label: '✗ Отменить', action: '_cancel', color: '#b03020' },
    ],
    reception: [
      { label: '▶ Взять в работу', action: 'take', color: '#d4613a' },
      { label: '→ Отправить в Исходящие', action: 'process', color: '#4a5aaa' },
    ],
    outgoing: [
      { label: '✓ Все доставлено', action: 'markAll', color: '#3a9d6e' },
      { label: '⏸ Отложить', action: 'postpone' },
    ],
    accounting: [
      { label: '→ Провести', action: 'postAcc', color: '#3a9d6e' },
      { label: '← Вернуть', action: 'returnOut' },
    ],
    bookkeeping: [
      { label: '📄 В 1С', action: 'post1C', color: '#4a5aaa' },
      { label: '→ Архив', action: 'sendArchive', color: '#3a9d6e' },
    ],
  }
  const acts = ACTIONS[order.screen] || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Шапка */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1efec', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9d9690', padding: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: '#d4613a' }}>{order.id}</span>
            <StatusBadge s={order.status} />
            {order.isChanged && <span style={{ background: '#fff0ea', color: '#c0532a', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>⚡ Изменено</span>}
          </div>
          <div style={{ fontSize: 13, color: '#6b655b', marginTop: 2 }}>{order.from}{order.to && ` → ${order.to}`}</div>
        </div>
        {order.trackingLink && (
          <a href={order.trackingLink} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#4a5aaa', textDecoration: 'none', background: '#eef2ff', padding: '4px 10px', borderRadius: 6 }}>
            🔗 Трекинг
          </a>
        )}
      </div>

      {/* Прогресс */}
      {order.positions.length > 0 && (
        <div style={{ padding: '12px 20px', background: '#fafaf9', borderBottom: '1px solid #f1efec' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#9d9690' }}>Прогресс</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: pctColor(totalPct) }}>{totalPct}%</span>
          </div>
          <Progress pct={totalPct} />
        </div>
      )}

      {/* Вкладки */}
      <div style={{ display: 'flex', borderBottom: '1px solid #f1efec', background: '#fff' }}>
        {(['info', 'pos', 'hist'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '12px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: tab === t ? 700 : 400, fontSize: 13, color: tab === t ? '#d4613a' : '#9d9690',
            borderBottom: tab === t ? '2px solid #d4613a' : '2px solid transparent',
            fontFamily: 'inherit',
          }}>
            {{ info: 'Инфо', pos: `Позиции (${order.positions.length})`, hist: 'История' }[t]}
          </button>
        ))}
      </div>

      {/* Контент */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>

        {tab === 'info' && (
          <div style={{ animation: 'ukfade .2s ease' }}>
            {/* Инфо */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                ['Заказчик', order.from],
                ['Получатель', order.to || '—'],
                ['Источник', order.source],
                ['Дата', fmtDT(order.createdAt)],
                order.deadline ? ['Дедлайн', fmt(order.deadline)] : null,
                order.phone ? ['Телефон', order.phone] : null,
                order.delivered ? ['Доставлено', fmt(order.delivered)] : null,
              ].filter((x): x is [string, string] => x !== null).map(([k, v]) => (
                <div key={k} style={{ background: '#fafaf9', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#9d9690', marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#26231f' }}>{v}</div>
                </div>
              ))}
            </div>

            {order.comment && (
              <div style={{ background: '#fafaf9', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#9d9690', marginBottom: 4 }}>Комментарий / Заявка</div>
                <div style={{ fontSize: 13, color: '#26231f', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{order.comment}</div>
              </div>
            )}

            {order.isChanged && (
              <div style={{ background: '#fff0ea', border: '1px solid #f4c4a8', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#c0532a', marginBottom: 6 }}>⚡ Клиент изменил заказ</div>
                <div style={{ fontSize: 13, color: '#26231f', marginBottom: 4 }}>{order.changeText}</div>
                <div style={{ fontSize: 12, color: '#9d9690', marginBottom: 10 }}>{order.changePhone}</div>
                <button onClick={() => onAction('confirmChg')} style={{ background: '#d4613a', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Подтвердить изменение
                </button>
              </div>
            )}

            {order.isCancelled && (
              <div style={{ background: '#faeaea', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#b03020', marginBottom: 4 }}>Заказ отменён</div>
                {order.cancelReason && <div style={{ fontSize: 13, color: '#26231f' }}>{order.cancelReason}</div>}
                <button onClick={() => onAction('restore')} style={{ marginTop: 10, background: '#fff', color: '#26231f', border: '1.5px solid #e0dbd3', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Восстановить
                </button>
              </div>
            )}

            {/* Документы (бухгалтерия) */}
            {order.screen === 'bookkeeping' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <button onClick={() => onAction('createDoc', { type: 'invoice' })}
                  style={{ padding: '7px 14px', background: order.invoice ? '#e8f5ee' : '#fff', color: order.invoice ? '#2e8a5e' : '#26231f', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {order.invoice ? '✓ Счёт' : '📄 Создать счёт'}
                </button>
                <button onClick={() => onAction('createDoc', { type: 'fact' })}
                  style={{ padding: '7px 14px', background: order.fact ? '#e8f5ee' : '#fff', color: order.fact ? '#2e8a5e' : '#26231f', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {order.fact ? '✓ Акт' : '📄 Создать акт'}
                </button>
                {!order.posted1C && (
                  <button onClick={() => onAction('post1C')}
                    style={{ padding: '7px 14px', background: '#fff', color: '#4a5aaa', border: '1.5px solid #c8d0f0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Провести в 1С
                  </button>
                )}
                {order.posted1C && !order.isCancelled && (
                  <button onClick={() => onAction('sendArchive')}
                    style={{ padding: '7px 14px', background: '#e8f5ee', color: '#2e8a5e', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    → Архив
                  </button>
                )}
              </div>
            )}

            {/* Итог */}
            {order.positions.length > 0 && (
              <div style={{ background: '#fff8f5', borderRadius: 8, padding: '12px 14px', textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#9d9690' }}>Итого</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#d4613a' }}>{fmtMoney(sum(order.positions))}</div>
              </div>
            )}
          </div>
        )}

        {tab === 'pos' && (
          <div style={{ animation: 'ukfade .2s ease' }}>
            {order.positions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9d9690' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 14 }}>Позиций нет<br /><span style={{ fontSize: 12 }}>Будут созданы из комментария при взятии в работу</span></div>
              </div>
            ) : (
              <div>
                {order.positions.map(p => (
                  <div key={p.id} style={{ background: '#fafaf9', borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: '1px solid #f1efec' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#211f1c', marginBottom: 1 }}>{p.name1c || p.oral || '—'}</div>
                        {p.oral && p.name1c && <div style={{ fontSize: 11, color: '#9d9690' }}>{p.oral}</div>}
                        <div style={{ fontSize: 12, color: '#6b655b', marginTop: 2 }}>
                          {p.qty} {p.unit} {p.price > 0 && `× ${fmtMoney(p.price)} = ${fmtMoney(p.qty * p.price)}`}
                        </div>
                        {p.supplier && <div style={{ fontSize: 11, color: '#9d9690' }}>📦 {p.supplier}</div>}
                        {p.resp && <div style={{ fontSize: 11, color: '#9d9690' }}>👤 {p.resp}</div>}
                      </div>
                      <StatusBadge s={p.status} />
                    </div>
                    {order.screen === 'outgoing' && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                        {POS_STATUSES.map(ps => (
                          <button key={ps} onClick={() => onAction('updatePos', { posId: p.id, status: ps })}
                            style={{ padding: '4px 8px', background: p.status === ps ? sc(ps).bg : '#fff', color: p.status === ps ? sc(ps).color : '#9d9690', border: `1px solid ${p.status === ps ? 'transparent' : '#e0dbd3'}`, borderRadius: 6, fontSize: 11, fontWeight: p.status === ps ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {ps}
                          </button>
                        ))}
                      </div>
                    )}
                    {p.late && <div style={{ fontSize: 11, color: '#b03020', marginTop: 4 }}>⚠ Просрочено</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'hist' && (
          <div style={{ animation: 'ukfade .2s ease' }}>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9d9690', padding: '40px 20px', fontSize: 14 }}>История пуста</div>
            ) : history.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: i < history.length - 1 ? '1px solid #f1efec' : 'none' }}>
                <div style={{ width: 32, height: 32, background: '#f1efec', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>📋</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#26231f' }}>{h.action}</div>
                  {h.detail && <div style={{ fontSize: 12, color: '#6b655b', marginTop: 1 }}>{h.detail}</div>}
                  <div style={{ fontSize: 11, color: '#9d9690', marginTop: 3 }}>{fmtDT(h.createdAt)} · {h.userName}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Кнопки действий */}
      {!order.isCancelled && acts.length > 0 && (
        <div style={{ padding: '14px 20px', borderTop: '1px solid #f1efec', display: 'flex', gap: 8, flexWrap: 'wrap', background: '#fff' }}>
          {acts.map(a => (
            a.action === '_cancel' ? (
              <div key="cancel" style={{ flex: 1 }}>
                {showCanc ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={cancReason} onChange={e => setCancReason(e.target.value)} placeholder="Причина отмены..." style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#26231f', outline: 'none' }} />
                    <button onClick={() => { onAction('cancel', { reason: cancReason }); setShowCanc(false) }} style={{ padding: '8px 14px', background: '#b03020', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✓</button>
                    <button onClick={() => setShowCanc(false)} style={{ padding: '8px 10px', background: '#f1efec', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
                  </div>
                ) : (
                  <button onClick={() => setShowCanc(true)} style={{ padding: '10px 16px', background: '#faeaea', color: '#b03020', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✗ Отменить
                  </button>
                )}
              </div>
            ) : (
              <button key={a.action} onClick={() => onAction(a.action)} style={{
                flex: 1, padding: '10px 16px', background: a.color || '#f1efec', color: a.color ? '#fff' : '#26231f',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{a.label}</button>
            )
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ЭКРАН: ВХОДЯЩИЕ ────────────────────────────────────────────────────────
const IncomingScreen = ({ orders, onSelect, selectedId, onAction, settings }: {
  orders: Order[]; onSelect: (o: Order) => void; selectedId?: string
  onAction: (id: string, action: string, payload?: Record<string, unknown>) => void
  settings: { users: User[]; suppliers: Supplier[]; nomenclature: Nomenclature[] }
}) => {
  const [filter, setFilter] = useState<'all' | 'waiting' | 'draft' | 'cancelled' | 'changed'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = orders.filter(o => {
    const q = search.toLowerCase()
    const matchSearch = !q || o.from.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) || o.comment.toLowerCase().includes(q)
    if (!matchSearch) return false
    if (filter === 'waiting') return !o.isDraft && !o.isCancelled
    if (filter === 'draft') return o.isDraft
    if (filter === 'cancelled') return o.isCancelled
    if (filter === 'changed') return o.isChanged
    return true
  })

  const TABS = [
    { k: 'all', label: `Все (${orders.length})` },
    { k: 'waiting', label: `Ожидают (${orders.filter(o => !o.isDraft && !o.isCancelled).length})` },
    { k: 'draft', label: `Черновики (${orders.filter(o => o.isDraft).length})` },
    { k: 'cancelled', label: `Отменены (${orders.filter(o => o.isCancelled).length})` },
    { k: 'changed', label: `Изменены (${orders.filter(o => o.isChanged).length})` },
  ]

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      <div style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e8e3db', overflow: 'hidden' }}>
        {/* Заголовок */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f1efec' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#211f1c' }}>Входящие</h2>
            <button onClick={() => setShowCreate(true)} style={{ background: '#d4613a', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Создать
            </button>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..." style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#26231f', outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button key={t.k} onClick={() => setFilter(t.k as typeof filter)}
                style={{ padding: '4px 10px', background: filter === t.k ? '#211f1c' : '#f1efec', color: filter === t.k ? '#fff' : '#6b655b', border: 'none', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9d9690', fontSize: 13, padding: '40px 20px' }}>Ничего не найдено</div>
          ) : filtered.map(o => (
            <Card key={o.id} order={o} onClick={() => onSelect(o)} selected={o.id === selectedId} />
          ))}
        </div>
      </div>

      {/* Правая панель */}
      <div style={{ flex: 1, overflow: 'auto', background: '#fafaf9' }}>
        {selectedId ? (
          <div style={{ height: '100%' }}>
            {orders.find(o => o.id === selectedId) && (
              <DetailPanel
                order={orders.find(o => o.id === selectedId)!}
                onAction={(a, p) => onAction(selectedId, a, p)}
                onClose={() => onSelect({ id: '' } as Order)}
                settings={settings}
              />
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9d9690', fontSize: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div>Выберите заявку для просмотра</div>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onCreated={() => setShowCreate(false)} settings={settings} />}
    </div>
  )
}

// ─── МОДАЛЬ СОЗДАНИЯ ────────────────────────────────────────────────────────
const CreateOrderModal = ({ onClose, onCreated, settings }: { onClose: () => void; onCreated: () => void; settings: { users: User[] } }) => {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [comment, setComment] = useState('')
  const [phone, setPhone] = useState('')
  const [deadline, setDeadline] = useState('')
  const [isDraft, setIsDraft] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const clients = settings.users.filter(u => ['client', 'supplier_client'].includes(u.role))

  const submit = async () => {
    if (!from) { setErr('Укажите заказчика'); return }
    setLoading(true); setErr('')
    try {
      await api('/api/orders', 'POST', { from, to, comment, phone, deadline, isDraft, source: 'admin_manual', fromId: clients.find(c => c.name === from)?.id })
      onCreated()
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Ошибка') }
    finally { setLoading(false) }
  }

  return (
    <Modal onClose={onClose} title="Новый заказ">
      <div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 5 }}>Заказчик *</label>
          <input list="clients-list" value={from} onChange={e => setFrom(e.target.value)} placeholder="Имя / компания..."
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', color: '#26231f', outline: 'none', boxSizing: 'border-box' }} required />
          <datalist id="clients-list">{clients.map(c => <option key={c.id} value={c.name} />)}</datalist>
        </div>
        <Inp label="Получатель / логист" value={to} onChange={setTo} placeholder="Нипа Листогиб, Центр Склад..." />
        <Inp label="Телефон" value={phone} onChange={setPhone} type="tel" placeholder="+7..." />
        <Inp label="Дедлайн" value={deadline} onChange={setDeadline} type="date" />
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 5 }}>Заявка / Комментарий</label>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} placeholder="Профнастил 50 листов&#10;Саморезы 2 уп..."
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', color: '#26231f', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16, fontSize: 14 }}>
          <input type="checkbox" checked={isDraft} onChange={e => setIsDraft(e.target.checked)} />
          Сохранить как черновик
        </label>
        {err && <div style={{ background: '#faeaea', color: '#b03020', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: '#f1efec', color: '#26231f', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
          <button onClick={submit} disabled={loading} style={{ flex: 2, padding: '12px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Создаём...' : isDraft ? 'Сохранить черновик' : 'Создать заказ'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── РЕCEPTIONSCREEN ────────────────────────────────────────────────────────
const ReceptionScreen = ({ orders, onSelect, selectedId, onAction, settings }: {
  orders: Order[]; onSelect: (o: Order) => void; selectedId?: string
  onAction: (id: string, action: string, payload?: Record<string, unknown>) => void
  settings: { users: User[]; suppliers: Supplier[]; nomenclature: Nomenclature[] }
}) => {
  const waiting = orders.filter(o => o.block === 'waiting' || !o.block)
  const processing = orders.filter(o => o.block === 'processing')

  const Column = ({ title, items, color }: { title: string; items: Order[]; color: string }) => (
    <div style={{ flex: 1, minWidth: 260 }}>
      <div style={{ padding: '10px 14px', borderRadius: '10px 10px 0 0', background: color, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{title}</span>
        <span style={{ marginLeft: 6, background: 'rgba(255,255,255,.25)', borderRadius: 20, padding: '1px 8px', fontSize: 12, color: '#fff' }}>{items.length}</span>
      </div>
      <div>{items.map(o => <Card key={o.id} order={o} onClick={() => onSelect(o)} selected={o.id === selectedId} />)}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      <div style={{ flex: '0 0 680px', padding: '16px', overflow: 'auto', borderRight: '1px solid #e8e3db' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Приёмка</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <Column title="Ожидание" items={waiting} color="#4a5aaa" />
          <Column title="В обработке" items={processing} color="#d4613a" />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', background: '#fafaf9' }}>
        {selectedId && orders.find(o => o.id === selectedId) ? (
          <DetailPanel order={orders.find(o => o.id === selectedId)!} onAction={(a, p) => onAction(selectedId, a, p)} onClose={() => onSelect({ id: '' } as Order)} settings={settings} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9d9690', fontSize: 14 }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>Выберите карточку</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── OUTGOING SCREEN ─────────────────────────────────────────────────────────
const OutgoingScreen = ({ orders, onSelect, selectedId, onAction, settings }: {
  orders: Order[]; onSelect: (o: Order) => void; selectedId?: string
  onAction: (id: string, action: string, payload?: Record<string, unknown>) => void
  settings: { users: User[]; suppliers: Supplier[]; nomenclature: Nomenclature[] }
}) => {
  const [sortBy, setSortBy] = useState<'pct' | 'date' | 'client'>('pct')
  const [filterBy, setFilterBy] = useState<'all' | 'late' | 'postponed'>('all')

  const sorted = [...orders]
    .filter(o => {
      if (filterBy === 'late') return o.positions.some(p => p.late)
      if (filterBy === 'postponed') return o.postponed
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'client') return a.from.localeCompare(b.from)
      if (sortBy === 'date') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      const pctA = a.positions.length === 0 ? 0 : a.positions.reduce((s, p) => s + ({ 'В работе': 10, 'Готово к отгрузке': 60, 'В пути': 80, 'Доставлено': 100 }[p.status] || 0), 0) / a.positions.length
      const pctB = b.positions.length === 0 ? 0 : b.positions.reduce((s, p) => s + ({ 'В работе': 10, 'Готово к отгрузке': 60, 'В пути': 80, 'Доставлено': 100 }[p.status] || 0), 0) / b.positions.length
      return pctA - pctB
    })

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e8e3db', overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f1efec' }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700 }}>Исходящие</h2>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {(['all', 'late', 'postponed'] as const).map(f => (
              <button key={f} onClick={() => setFilterBy(f)} style={{ padding: '4px 10px', background: filterBy === f ? '#211f1c' : '#f1efec', color: filterBy === f ? '#fff' : '#6b655b', border: 'none', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {{ all: `Все (${orders.length})`, late: 'Просрочено', postponed: 'Отложено' }[f]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#9d9690', padding: '4px 4px' }}>Сортировка:</span>
            {(['pct', 'date', 'client'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)} style={{ padding: '4px 8px', background: sortBy === s ? '#f1efec' : 'none', border: 'none', borderRadius: 6, fontSize: 11, color: sortBy === s ? '#26231f' : '#9d9690', cursor: 'pointer', fontFamily: 'inherit', fontWeight: sortBy === s ? 600 : 400 }}>
                {{ pct: '% готовности', date: 'Дата', client: 'Клиент' }[s]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {sorted.map(o => <Card key={o.id} order={o} onClick={() => onSelect(o)} selected={o.id === selectedId} />)}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', background: '#fafaf9' }}>
        {selectedId && orders.find(o => o.id === selectedId) ? (
          <DetailPanel order={orders.find(o => o.id === selectedId)!} onAction={(a, p) => onAction(selectedId, a, p)} onClose={() => onSelect({ id: '' } as Order)} settings={settings} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9d9690', fontSize: 14 }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 40, marginBottom: 12 }}>🚚</div>Выберите заказ</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── FILTER / SEARCH ─────────────────────────────────────────────────────────
const FilterScreen = ({ orders }: { orders: Order[] }) => {
  const [q, setQ] = useState('')
  const [fromD, setFromD] = useState('')
  const [toD, setToD] = useState('')
  const [screen, setScreen] = useState('')

  const res = orders.filter(o => {
    if (q && !o.id.toLowerCase().includes(q.toLowerCase()) && !o.from.toLowerCase().includes(q.toLowerCase()) && !o.comment.toLowerCase().includes(q.toLowerCase())) return false
    if (fromD && new Date(o.createdAt) < new Date(fromD)) return false
    if (toD && new Date(o.createdAt) > new Date(toD + 'T23:59:59')) return false
    if (screen && o.screen !== screen) return false
    return true
  })

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Поиск и фильтры</h2>
      <div style={{ background: '#fff', borderRadius: 12, padding: '20px', border: '1px solid #e8e3db', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b655b', display: 'block', marginBottom: 5 }}>Поиск</label>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="ID, клиент, текст..."
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b655b', display: 'block', marginBottom: 5 }}>Дата от</label>
            <input type="date" value={fromD} onChange={e => setFromD(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b655b', display: 'block', marginBottom: 5 }}>Дата до</label>
            <input type="date" value={toD} onChange={e => setToD(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b655b', display: 'block', marginBottom: 5 }}>Экран</label>
            <select value={screen} onChange={e => setScreen(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">Все</option>
              {['incoming', 'reception', 'outgoing', 'accounting', 'bookkeeping', 'archive'].map(s => (
                <option key={s} value={s}>{{ incoming: 'Входящие', reception: 'Приёмка', outgoing: 'Исходящие', accounting: 'К учёту', bookkeeping: 'Бухгалтерия', archive: 'Архив' }[s]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div style={{ color: '#9d9690', fontSize: 13, marginBottom: 12 }}>Найдено: <strong style={{ color: '#26231f' }}>{res.length}</strong></div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e3db', overflow: 'hidden' }}>
        {res.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9d9690', fontSize: 14 }}>Ничего не найдено</div>
        ) : res.map((o, i) => (
          <div key={o.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 12, padding: '12px 16px', alignItems: 'center', borderBottom: i < res.length - 1 ? '1px solid #f1efec' : 'none' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#d4613a', fontWeight: 700 }}>{o.id}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{o.from}</div>
              {o.comment && <div style={{ fontSize: 11, color: '#9d9690', marginTop: 1 }}>{o.comment.slice(0, 60)}{o.comment.length > 60 && '...'}</div>}
            </div>
            <StatusBadge s={o.status} />
            <span style={{ fontSize: 11, color: '#9d9690' }}>{fmt(o.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ACCOUNTING ───────────────────────────────────────────────────────────────
const AccountingScreen = ({ orders, onSelect, selectedId, onAction, settings }: {
  orders: Order[]; onSelect: (o: Order) => void; selectedId?: string
  onAction: (id: string, action: string, payload?: Record<string, unknown>) => void
  settings: { users: User[]; suppliers: Supplier[]; nomenclature: Nomenclature[] }
}) => (
  <div style={{ display: 'flex', height: '100%' }}>
    <div style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e8e3db', overflow: 'hidden' }}>
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f1efec' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>К учёту ({orders.length})</h2>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {orders.map(o => <Card key={o.id} order={o} onClick={() => onSelect(o)} selected={o.id === selectedId} />)}
      </div>
    </div>
    <div style={{ flex: 1, overflow: 'auto', background: '#fafaf9' }}>
      {selectedId && orders.find(o => o.id === selectedId) ? (
        <DetailPanel order={orders.find(o => o.id === selectedId)!} onAction={(a, p) => onAction(selectedId, a, p)} onClose={() => onSelect({ id: '' } as Order)} settings={settings} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9d9690', fontSize: 14 }}>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>Выберите заказ</div>
        </div>
      )}
    </div>
  </div>
)

// ─── BOOKKEEPING ─────────────────────────────────────────────────────────────
const BookkeepingScreen = ({ orders, onSelect, selectedId, onAction, onPostAll, settings }: {
  orders: Order[]; onSelect: (o: Order) => void; selectedId?: string
  onAction: (id: string, action: string, payload?: Record<string, unknown>) => void
  onPostAll: () => void
  settings: { users: User[]; suppliers: Supplier[]; nomenclature: Nomenclature[] }
}) => {
  const total = orders.reduce((s, o) => s + sum(o.positions), 0)
  const posted = orders.filter(o => o.posted1C)

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e8e3db', overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f1efec' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Бухгалтерия ({orders.length})</h2>
          </div>
          <div style={{ background: '#fff8f5', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: '#9d9690' }}>Сумма всего</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#d4613a' }}>{fmtMoney(total)}</div>
          </div>
          <div style={{ fontSize: 12, color: '#9d9690', marginBottom: 8 }}>В 1С: {posted.length} из {orders.length}</div>
          <button onClick={onPostAll} style={{ width: '100%', padding: '9px', background: '#4a5aaa', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            → Провести все в 1С
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {orders.map(o => <Card key={o.id} order={o} onClick={() => onSelect(o)} selected={o.id === selectedId} />)}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', background: '#fafaf9' }}>
        {selectedId && orders.find(o => o.id === selectedId) ? (
          <DetailPanel order={orders.find(o => o.id === selectedId)!} onAction={(a, p) => onAction(selectedId, a, p)} onClose={() => onSelect({ id: '' } as Order)} settings={settings} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9d9690', fontSize: 14 }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>Выберите документ</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ARCHIVE ─────────────────────────────────────────────────────────────────
const ArchiveScreen = ({ orders }: { orders: Order[] }) => {
  const [q, setQ] = useState('')
  const res = orders.filter(o => !q || o.id.includes(q) || o.from.toLowerCase().includes(q.toLowerCase()))

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Архив ({orders.length})</h2>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск..."
          style={{ padding: '9px 14px', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: 220 }} />
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e3db', overflow: 'hidden' }}>
        {res.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9d9690' }}>Архив пуст</div>
        ) : res.map((o, i) => (
          <div key={o.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: 12, padding: '12px 16px', alignItems: 'center', borderBottom: i < res.length - 1 ? '1px solid #f1efec' : 'none' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#9d9690', fontWeight: 600 }}>{o.id}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{o.from}</div>
              <div style={{ fontSize: 11, color: '#9d9690' }}>→ {o.to || '—'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtMoney(sum(o.positions))}</div>
              <div style={{ fontSize: 11, color: '#9d9690' }}>{o.positions.length} поз.</div>
            </div>
            <StatusBadge s={o.status} />
            <span style={{ fontSize: 11, color: '#9d9690', whiteSpace: 'nowrap' }}>{fmt(o.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
const DashboardScreen = ({ data, onNavigate }: { data: DashData; onNavigate: (screen: string) => void }) => {
  const { kpi, flow, progress, attention, activity, topClients, specProjects } = data
  const flowItems = [
    { label: 'Входящие', key: 'incoming', screen: 'incoming', icon: '📋', color: '#4a5aaa' },
    { label: 'Приёмка', key: 'reception', screen: 'reception', icon: '📦', color: '#d4613a' },
    { label: 'Исходящие', key: 'outgoing', screen: 'outgoing', icon: '🚚', color: '#c4a832' },
    { label: 'К учёту', key: 'accounting', screen: 'accounting', icon: '🧾', color: '#3a9d6e' },
    { label: 'Бухгалтерия', key: 'bookkeeping', screen: 'bookkeeping', icon: '💼', color: '#6b655b' },
    { label: 'Архив', key: 'archive', screen: 'archive', icon: '📂', color: '#9d9690' },
  ]

  return (
    <div style={{ padding: '24px', overflow: 'auto', height: '100%' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Сводка</h2>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Активных заказов', val: kpi.active, icon: '📋', color: '#4a5aaa' },
          { label: 'Доставлено сегодня', val: kpi.deliveredToday, icon: '✅', color: '#3a9d6e' },
          { label: 'В работе', val: kpi.inwork, icon: '🚚', color: '#d4613a' },
          { label: 'Просрочено', val: kpi.overdue, icon: '⚠', color: '#b03020' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e8e3db' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{k.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 12, color: '#9d9690', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Поток */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e8e3db', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Поток заказов</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {flowItems.map((f, i) => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <button onClick={() => onNavigate(f.screen)} style={{ background: '#fafaf9', border: '1px solid #e8e3db', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: 18, marginBottom: 3 }}>{f.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: f.color }}>{flow[f.key] || 0}</div>
                <div style={{ fontSize: 11, color: '#9d9690' }}>{f.label}</div>
              </button>
              {i < flowItems.length - 1 && <span style={{ color: '#e0dbd3', fontSize: 20, padding: '0 2px' }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {/* Прогресс */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e8e3db' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Прогресс отгрузки</div>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: pctColor(progress.overallPct) }}>{progress.overallPct}%</div>
            <div style={{ fontSize: 12, color: '#9d9690' }}>средний по активным</div>
          </div>
          <Progress pct={progress.overallPct} />
        </div>

        {/* Внимание */}
        {attention.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e8e3db' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Требуют внимания</div>
            {attention.map((a, i) => (
              <button key={i} onClick={() => onNavigate(a.screen)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fafaf9', border: '1px solid #f1efec', borderRadius: 8, cursor: 'pointer', marginBottom: 6, fontFamily: 'inherit', textAlign: 'left' }}>
                <div style={{ width: 8, height: 8, background: '#d4613a', borderRadius: '50%', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#26231f' }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: '#9d9690' }}>{a.sub}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Топ клиенты */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e8e3db' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Топ клиенты (месяц)</div>
          {topClients.map(c => (
            <div key={c.name} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{c.count}</span>
              </div>
              <Progress pct={c.pct} />
            </div>
          ))}
        </div>

        {/* СпецПроекты */}
        {specProjects.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e8e3db' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>СпецПроекты</div>
            {specProjects.map(sp => (
              <div key={sp.id} style={{ marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #f1efec' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{sp.name}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: pctColor(sp.pct) }}>{sp.pct}%</span>
                </div>
                <Progress pct={sp.pct} />
                <div style={{ fontSize: 11, color: '#9d9690', marginTop: 3 }}>{sp.cardCount} карточек</div>
              </div>
            ))}
          </div>
        )}

        {/* Лента активности */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e8e3db' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Активность</div>
          {activity.slice(0, 6).map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: i < 5 ? '1px solid #f1efec' : 'none' }}>
              <div style={{ width: 28, height: 28, background: '#f1efec', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>📋</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{a.action}</div>
                {a.detail && <div style={{ fontSize: 11, color: '#6b655b' }}>{a.detail}</div>}
                <div style={{ fontSize: 11, color: '#9d9690' }}>{fmtDT(a.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
const SettingsScreen = ({ settings, onRefresh }: { settings: { users: User[]; suppliers: Supplier[]; nomenclature: Nomenclature[]; projects: Project[]; specProjects: SpecProject[] }; onRefresh: () => void }) => {
  const [tab, setTab] = useState<'users' | 'suppliers' | 'nomenclature'>('users')
  const [showAddUser, setShowAddUser] = useState(false)
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState('')
  const [role, setRole] = useState('logist'); const [password, setPassword] = useState('')
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(false)

  const addUser = async () => {
    if (!name) { setErr('Введите имя'); return }
    setLoading(true); setErr('')
    try {
      const data = await api('/api/users', 'POST', { name, email, phone, role, password })
      if (data.accessUrl) alert(`Ссылка доступа: ${data.accessUrl}`)
      setShowAddUser(false); setName(''); setEmail(''); setPhone(''); setPassword('')
      onRefresh()
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Ошибка') }
    finally { setLoading(false) }
  }

  const toggleUser = async (id: string, active: boolean) => {
    await api(`/api/users/${id}`, 'PUT', { active: !active })
    onRefresh()
  }

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Настройки</h2>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['users', 'suppliers', 'nomenclature'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', background: tab === t ? '#211f1c' : '#fff', color: tab === t ? '#fff' : '#6b655b', border: '1px solid #e8e3db', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {{ users: 'Пользователи', suppliers: 'Поставщики', nomenclature: 'Номенклатура' }[t]}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button onClick={() => setShowAddUser(true)} style={{ padding: '8px 16px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Добавить</button>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e3db', overflow: 'hidden' }}>
            {settings.users.map((u, i) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < settings.users.length - 1 ? '1px solid #f1efec' : 'none' }}>
                <div style={{ width: 36, height: 36, background: u.active ? '#f1efec' : '#faeaea', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: u.active ? '#d4613a' : '#b03020', flexShrink: 0 }}>
                  {u.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: '#9d9690' }}>{u.email || u.phone || '—'} · {u.role}</div>
                </div>
                {u.slug && (
                  <div style={{ fontSize: 11, color: '#4a5aaa', background: '#eef2ff', padding: '3px 8px', borderRadius: 6 }}>/{u.slug}</div>
                )}
                <button onClick={() => toggleUser(u.id, u.active)} style={{ padding: '5px 12px', background: u.active ? '#e8f5ee' : '#faeaea', color: u.active ? '#2e8a5e' : '#b03020', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {u.active ? 'Активен' : 'Откл.'}
                </button>
              </div>
            ))}
          </div>
          {showAddUser && (
            <Modal onClose={() => setShowAddUser(false)} title="Добавить пользователя">
              <Inp label="Имя *" value={name} onChange={setName} placeholder="Иванов Иван" required />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b655b', marginBottom: 5 }}>Роль *</label>
                <select value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e0dbd3', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}>
                  <option value="logist">Логист</option>
                  <option value="client">Клиент</option>
                  <option value="supplier_client">Клиент-поставщик</option>
                  <option value="bookkeeper">Бухгалтер</option>
                  <option value="super_admin">Супер-Админ</option>
                </select>
              </div>
              <Inp label="Email" value={email} onChange={setEmail} type="email" placeholder="user@company.kz" />
              <Inp label="Телефон" value={phone} onChange={setPhone} type="tel" placeholder="+7..." />
              <Inp label="Пароль" value={password} onChange={setPassword} type="password" placeholder="Для логистов и сотрудников" />
              {err && <div style={{ background: '#faeaea', color: '#b03020', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{err}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAddUser(false)} style={{ flex: 1, padding: '11px', background: '#f1efec', color: '#26231f', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
                <button onClick={addUser} disabled={loading} style={{ flex: 2, padding: '11px', background: '#d4613a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Добавляем...' : 'Добавить'}
                </button>
              </div>
            </Modal>
          )}
        </div>
      )}

      {tab === 'suppliers' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e3db', overflow: 'hidden' }}>
          {settings.suppliers.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < settings.suppliers.length - 1 ? '1px solid #f1efec' : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#9d9690' }}>{s.type}</div>
              </div>
              <span style={{ fontSize: 12, color: s.active ? '#2e8a5e' : '#b03020', background: s.active ? '#e8f5ee' : '#faeaea', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                {s.active ? 'Активен' : 'Откл.'}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'nomenclature' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e3db', overflow: 'hidden' }}>
          {settings.nomenclature.map((n, i) => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < settings.nomenclature.length - 1 ? '1px solid #f1efec' : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{n.name}</div>
                <div style={{ fontSize: 12, color: '#9d9690' }}>{n.cat}</div>
              </div>
              <span style={{ fontSize: 12, color: '#6b655b', background: '#f1efec', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{n.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ГЛАВНЫЙ КОМПОНЕНТ ───────────────────────────────────────────────────────
interface AppProps { userName: string; userRole: string }

export default function AdminApp({ userName, userRole }: AppProps) {
  const [screen, setScreen] = useState('dashboard')
  const [orders, setOrders] = useState<Order[]>([])
  const [dash, setDash] = useState<DashData | null>(null)
  const [settings, setSettings] = useState<{ users: User[]; suppliers: Supplier[]; nomenclature: Nomenclature[]; projects: Project[]; specProjects: SpecProject[] }>({ users: [], suppliers: [], nomenclature: [], projects: [], specProjects: [] })
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [ordersData, dashData, settingsData] = await Promise.all([
        fetch('/api/orders/all').then(r => r.json()),
        fetch('/api/dashboard').then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
      ])
      setOrders(Array.isArray(ordersData) ? ordersData : [])
      setDash(dashData)
      setSettings(settingsData || { users: [], suppliers: [], nomenclature: [], projects: [], specProjects: [] })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleAction = useCallback(async (orderId: string, action: string, payload?: Record<string, unknown>) => {
    try {
      await api(`/api/orders/${orderId}/action`, 'POST', { action, ...payload })
      showToast('Готово ✓')
      loadAll()
    } catch (e: unknown) { showToast((e instanceof Error ? e.message : '') || 'Ошибка') }
  }, [loadAll, showToast])

  const handlePostAll = useCallback(async () => {
    try {
      const d = await api('/api/orders/postAll', 'POST')
      showToast(`Проведено ${d.count} документов`)
      loadAll()
    } catch (e: unknown) { showToast((e instanceof Error ? e.message : '') || 'Ошибка') }
  }, [loadAll, showToast])

  const byScreen = (s: string) => orders.filter(o => o.screen === s)

  const MENU = [
    { key: 'dashboard', label: 'Сводка', icon: '📊' },
    { key: 'incoming', label: 'Входящие', icon: '📋', count: byScreen('incoming').filter(o => !o.isDraft && !o.isCancelled).length },
    { key: 'reception', label: 'Приёмка', icon: '📦', count: byScreen('reception').length },
    { key: 'outgoing', label: 'Исходящие', icon: '🚚', count: byScreen('outgoing').length },
    { key: 'filter', label: 'Поиск', icon: '🔍' },
    userRole !== 'bookkeeper' ? null : undefined,
    { key: 'accounting', label: 'К учёту', icon: '🧾', count: byScreen('accounting').length },
    { key: 'bookkeeping', label: 'Бухгалтерия', icon: '💼', count: byScreen('bookkeeping').length },
    { key: 'archive', label: 'Архив', icon: '📂' },
    { key: 'settings', label: 'Настройки', icon: '⚙️' },
  ].filter(Boolean) as { key: string; label: string; icon: string; count?: number }[]

  const navigate = (s: string) => { setScreen(s); setSelectedId(undefined); setMobileOpen(false) }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid #e8e3db' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#d4613a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Ю</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#211f1c' }}>U-Kan</div>
            <div style={{ fontSize: 11, color: '#9d9690' }}>{userName}</div>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '12px 8px', overflow: 'auto' }}>
        {MENU.map(m => (
          <button key={m.key} onClick={() => navigate(m.key)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            background: screen === m.key ? '#fff0ea' : 'none', border: 'none', borderRadius: 10,
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', marginBottom: 2,
            color: screen === m.key ? '#d4613a' : '#6b655b',
          }}>
            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{m.icon}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: screen === m.key ? 700 : 400 }}>{m.label}</span>
            {m.count !== undefined && m.count > 0 && (
              <span style={{ background: m.key === 'incoming' ? '#eef2ff' : '#fff0ea', color: m.key === 'incoming' ? '#4a5aaa' : '#d4613a', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>{m.count}</span>
            )}
          </button>
        ))}
      </nav>
      <div style={{ padding: '12px 8px', borderTop: '1px solid #e8e3db' }}>
        <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login' }}
          style={{ width: '100%', padding: '10px 12px', background: '#faeaea', color: '#b03020', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13 }}>
          Выйти
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f1efec', fontFamily: 'Golos Text, system-ui, sans-serif' }}>
      {/* Desktop Sidebar */}
      <div className="sidebar-desktop" style={{ width: 220, background: '#fafaf9', borderRight: '1px solid #e8e3db', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <SidebarContent />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 240, height: '100%', background: '#fafaf9', boxShadow: '4px 0 24px rgba(0,0,0,.15)' }}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Mobile header */}
        <div className="mobile-menu-btn" style={{ display: 'none', alignItems: 'center', padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e8e3db', gap: 12 }}>
          <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 0, color: '#26231f' }}>☰</button>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#d4613a' }}>{MENU.find(m => m.key === screen)?.label || 'U-Kan'}</span>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9d9690', fontSize: 14 }}>Загрузка...</div>
          ) : (
            <>
              {screen === 'dashboard' && dash && <DashboardScreen data={dash} onNavigate={navigate} />}
              {screen === 'incoming' && <IncomingScreen orders={byScreen('incoming')} onSelect={o => setSelectedId(o.id || undefined)} selectedId={selectedId} onAction={handleAction} settings={settings} />}
              {screen === 'reception' && <ReceptionScreen orders={byScreen('reception')} onSelect={o => setSelectedId(o.id || undefined)} selectedId={selectedId} onAction={handleAction} settings={settings} />}
              {screen === 'outgoing' && <OutgoingScreen orders={byScreen('outgoing')} onSelect={o => setSelectedId(o.id || undefined)} selectedId={selectedId} onAction={handleAction} settings={settings} />}
              {screen === 'filter' && <FilterScreen orders={orders} />}
              {screen === 'accounting' && <AccountingScreen orders={byScreen('accounting')} onSelect={o => setSelectedId(o.id || undefined)} selectedId={selectedId} onAction={handleAction} settings={settings} />}
              {screen === 'bookkeeping' && <BookkeepingScreen orders={byScreen('bookkeeping')} onSelect={o => setSelectedId(o.id || undefined)} selectedId={selectedId} onAction={handleAction} onPostAll={handlePostAll} settings={settings} />}
              {screen === 'archive' && <ArchiveScreen orders={byScreen('archive')} />}
              {screen === 'settings' && <SettingsScreen settings={settings} onRefresh={loadAll} />}
              {screen === 'warehouse' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9d9690' }}>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 12 }}>🏭</div><div>Склад — в разработке</div></div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
