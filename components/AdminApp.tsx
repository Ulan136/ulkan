'use client'
<<<<<<< HEAD

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  SessionUser,
  Order,
  User,
  Project,
  SpecProject,
  Nomenclature,
  Stock,
  DailyReport,
  AdminScreen,
  IncTab,
  FilterGroup,
  FilterStatus,
  AdminFilterSelections,
  EMPTY_FILTER_SELECTIONS,
  ArchiveTab,
  SettingsTab,
  BookkeepingTab,
} from '@/lib/types'
import {
  fetchAllOrders,
  fetchDashboard,
  fetchSettings,
  orderAction,
  postAll,
  logout,
  createOrder,
  fetchHistory,
  fetchStock,
  fetchStockMovements,
  fetchDailyReports,
  updateDailyReport,
  createUser,
  updateUser,
  createProject,
  createSpecProject,
  createNomenclature,
  createPaymentStatus,
} from '@/lib/api'
import {
  cardProgress,
  cardSum,
  isOverdue,
  sourceLabel,
  fmtMoney,
  fmtDate,
  fmtDateTime,
  posPct,
  barColor,
  statusStyle,
  sourceStyle,
  roleLabel,
} from '@/lib/display'

// ─── Types ────────────────────────────────────────────────────────────────────

type OutgoingTab = 'inwork' | 'ready' | 'all'

interface HistoryItem {
  id: string
  action: string
  detail: string
  userName: string
  createdAt: string
}

interface PaymentStatus {
  id: string
  name: string
  active: boolean
}

interface StockMovement {
  id: string
  type: string
  name: string
  qty: number
  unit: string
  cardId?: string
  createdAt: string
}

interface SettingsData {
  users: User[]
  projects: Project[]
  specProjects: SpecProject[]
  suppliers: { id: string; name: string; type: string; active: boolean }[]
  nomenclature: Nomenclature[]
  paymentStatuses: PaymentStatus[]
}

const EMPTY_SETTINGS: SettingsData = {
  users: [], projects: [], specProjects: [], suppliers: [], nomenclature: [], paymentStatuses: [],
}

interface DashboardData {
  kpi: { active: number; deliveredToday: number; overdue: number; inwork: number; turnoverToday: number }
  flow: { incoming: number; reception: number; outgoing: number; accounting: number; bookkeeping: number; archive: number }
  progress: { overallPct: number; inwork: number; delivered: number; overdue: number }
  attention: Array<{ label: string; sub: string; tag: string; hue: string; screen: string }>
  activity: Array<{ text: string; sub: string; time: string }>
  topClients: Array<{ name: string; count: number; pct: number }>
  specProjects?: Array<{ id: string; name: string; pct: number; cards: number }>
}

interface FormPosition {
  name: string
  qty: number
  price: number
  resp: string
  supplier: string
  deadline: string
  payment: string
  showPayment: boolean
}

interface UserFormData {
  id?: string
  name: string
  role: string
  companyId: string
  email: string
  phone: string
  password: string
  slug: string
  active: boolean
}
=======
import { useState, useEffect, useCallback, useRef } from 'react'
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b

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

<<<<<<< HEAD
const POS_STATUSES = ['В работе', 'Готово к отгрузке', 'В пути', 'Доставлено'] as const

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  super_admin: { bg: '#eef2ff', color: '#4a5aaa' },
  bookkeeper: { bg: '#e8f5ee', color: '#2e8a5e' },
  logist: { bg: '#fff0ea', color: '#c0532a' },
  supplier_client: { bg: '#f3eeff', color: '#7a3aaa' },
  client: { bg: '#eef2ff', color: '#4a5aaa' },
}

function copyText(text: string) {
  try { navigator.clipboard.writeText(text) } catch { /* ignore */ }
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'user'
}

function userLink(u: User): string | null {
  if (u.role === 'logist' && u.slug) return `${typeof window !== 'undefined' ? window.location.origin : ''}/rsp/${u.slug}`
  if ((u.role === 'client' || u.role === 'supplier_client') && u.slug) return `${typeof window !== 'undefined' ? window.location.origin : ''}/client/${u.slug}`
  return null
}

function loadColumnOrder(group: FilterGroup): string[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`ukan-filter-columns-${group}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveColumnOrder(group: FilterGroup, order: string[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(`ukan-filter-columns-${group}`, JSON.stringify(order)) } catch { /* ignore */ }
}

function isClientRole(role: string) {
  return role === 'client' || role === 'supplier_client'
}

function emptyPos(): FormPosition {
  return { name: '', qty: 1, price: 0, resp: '', supplier: '', deadline: '', payment: 'Не оплачено', showPayment: false }
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Btn({ children, onClick, variant = 'default', size = 'md', disabled }: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'default' | 'danger' | 'ghost' | 'dark'
  size?: 'sm' | 'md'
  disabled?: boolean
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: '#d4613a', color: '#fff', border: '1px solid transparent' },
    default: { background: '#fff', color: '#3a352f', border: '1px solid #d8d3cc' },
    danger: { background: '#fff', color: '#c0392b', border: '1px solid #e6dcd6' },
    ghost: { background: 'transparent', color: '#6b655b', border: '1px solid #d8d3cc' },
    dark: { background: '#211f1c', color: '#fff', border: '1px solid transparent' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        padding: size === 'sm' ? '6px 10px' : '7px 13px',
        borderRadius: 7,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        fontWeight: 600,
        fontSize: size === 'sm' ? 11 : 12,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  )
}

function Toast({ msg }: { msg: string }) {
  return (
    <div style={{
      position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
      background: '#211f1c', color: '#fff', padding: '11px 20px', borderRadius: 9,
      fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,.22)',
      animation: 'uktoast .2s', zIndex: 50,
    }}
    >
      {msg}
    </div>
  )
}

function ProgressBar({ pct, height = 5 }: { pct: number; height?: number }) {
  return (
    <div style={{ height, background: '#f0ece6', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: barColor(pct), transition: 'width .3s' }} />
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 14px', border: 'none',
        borderBottom: `2px solid ${active ? '#d4613a' : 'transparent'}`,
        background: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13, fontWeight: active ? 700 : 500,
        color: active ? '#26231f' : '#8a847c', marginBottom: -1,
      }}
    >
      {children}
    </button>
  )
}

// ─── Card Detail Modal ────────────────────────────────────────────────────────

function CardDetailModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loadingHist, setLoadingHist] = useState(true)
  const prog = cardProgress(order)
  const sum = cardSum(order)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/track?id=${order.id}` : order.trackingLink

  useEffect(() => {
    let cancelled = false
    setLoadingHist(true)
    fetchHistory(order.id)
      .then((data: HistoryItem[]) => { if (!cancelled) setHistory(data) })
      .catch(() => { if (!cancelled) setHistory([]) })
      .finally(() => { if (!cancelled) setLoadingHist(false) })
    return () => { cancelled = true }
  }, [order.id])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(33,31,28,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 45, padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, width: 580, maxWidth: '100%', maxHeight: '88vh',
          overflowY: 'auto', animation: 'ukpop .18s', boxShadow: '0 24px 60px rgba(0,0,0,.28)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '17px 22px',
          borderBottom: '1px solid #eee8e1', position: 'sticky', top: 0, background: '#fff', zIndex: 1,
        }}
        >
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 15 }}>{order.id}</span>
          <span style={statusStyle(order.status)}>{order.status}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#a39c92' }}>
            {sourceLabel(order.source)} · {fmtDateTime(order.createdAt)}
          </span>
          <button onClick={onClose} style={{ width: 30, height: 30, border: 'none', background: '#f1ede7', borderRadius: 8, cursor: 'pointer', color: '#6b655b', fontSize: 14 }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{order.from} → {order.to || '—'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 20px' }}>
            <div style={{ flex: 1 }}><ProgressBar pct={prog} height={7} /></div>
            <span style={{ fontSize: 12, color: '#8a847c', fontFamily: 'JetBrains Mono, monospace' }}>{prog}%</span>
          </div>
          <div style={{ fontSize: 10.5, color: '#a39c92', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 9 }}>
            Позиции <span style={{ color: '#c0532a' }}>· цены только в админке</span>
          </div>
          {order.positions.length === 0 && (
            <div style={{ fontSize: 12.5, color: '#a39c92', padding: '4px 0 14px' }}>
              Позиции ещё не сформированы — заявка из комментария.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {order.positions.map((p, i) => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 86px 116px', gap: 10, alignItems: 'center', padding: '10px 12px', background: '#faf8f6', borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: '#b8b1a6', fontFamily: 'JetBrains Mono, monospace' }}>{i + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{p.name1c || p.oral || '—'}</span>
                  <span style={statusStyle(p.status || 'В работе')}>{p.status || 'В работе'}</span>
                </div>
                <span style={{ fontSize: 12, color: '#6b655b', fontFamily: 'JetBrains Mono, monospace' }}>{p.qty} {p.unit}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(p.qty * p.price)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: '#fdf0ea', borderRadius: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 12.5, color: '#6b655b' }}>Сумма заказа</span>
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(sum)}</span>
          </div>
          <div style={{ fontSize: 10.5, color: '#a39c92', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 9 }}>История</div>
          {loadingHist ? (
            <div style={{ fontSize: 12.5, color: '#a39c92', marginBottom: 16 }}>Загрузка…</div>
          ) : history.length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#a39c92', marginBottom: 16 }}>Записей нет</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 20 }}>
              {history.map(h => (
                <div key={h.id} style={{ display: 'flex', gap: 11, padding: '7px 0', borderBottom: '1px solid #f1ede7' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d4613a', marginTop: 5, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500 }}>{h.action}{h.detail ? ` — ${h.detail}` : ''}</span>
                    <span style={{ display: 'block', fontSize: 11, color: '#a39c92' }}>{h.userName}</span>
                  </span>
                  <span style={{ fontSize: 10.5, color: '#b8b1a6', whiteSpace: 'nowrap' }}>{fmtDateTime(h.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 9 }}>
            <input value={url} readOnly style={{ flex: 1, padding: '9px 11px', border: '1px solid #e0dcd5', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: '#6b655b', background: '#faf8f6' }} />
            <Btn onClick={() => copyText(url)}>📋 Ссылка</Btn>
            <a href={`/track?id=${order.id}`} target="_blank" rel="noreferrer" style={{ background: '#d4613a', color: '#fff', padding: '9px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center' }}>Трекинг →</a>
          </div>
        </div>
=======
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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
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

<<<<<<< HEAD
// ─── User Modal ───────────────────────────────────────────────────────────────

function UserModal({ user, allUsers, onClose, onSave, onToast }: {
  user: UserFormData | null
  allUsers: User[]
  onClose: () => void
  onSave: (data: UserFormData, isNew: boolean) => Promise<{ password?: string; user: User }>
  onToast: (msg: string) => void
}) {
  const isNew = !user?.id
  const [form, setForm] = useState<UserFormData>(user || {
    name: '', role: 'client', companyId: '', email: '', phone: '', password: '', slug: '', active: true,
  })
  const [saving, setSaving] = useState(false)
  const [access, setAccess] = useState<{ link: string; login: string; password: string } | null>(null)

  const companies = allUsers.filter(u => isClientRole(u.role) && !u.companyId)
  const subUsers = allUsers.filter(u => u.companyId === form.id)

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const result = await onSave(form, isNew)
      if (isNew && result.password) {
        const link = userLink(result.user) || ''
        setAccess({ link, login: result.user.email || result.user.phone || '', password: result.password })
      } else {
        onToast('✓ Пользователь сохранён')
        onClose()
      }
    } catch (e) {
      onToast(`Ошибка: ${(e as Error).message}`)
    } finally { setSaving(false) }
  }

  if (access) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(33,31,28,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 440, maxWidth: '100%', padding: 24, animation: 'ukpop .18s' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#2e8a5e' }}>✓ Пользователь создан!</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#6b655b' }}>Ссылка
              <input readOnly value={access.link} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontSize: 12 }} />
            </label>
            <div style={{ fontSize: 13 }}>Логин: <b>{access.login}</b></div>
            <div style={{ fontSize: 13 }}>Пароль: <b>{access.password}</b></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn onClick={() => copyText(`Ссылка: ${access.link}\nЛогин: ${access.login}\nПароль: ${access.password}`)}>📋 Скопировать всё</Btn>
            <Btn variant="primary" onClick={onClose}>Закрыть</Btn>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(33,31,28,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 480, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22, animation: 'ukpop .18s' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{isNew ? 'Новый пользователь' : 'Редактировать пользователя'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 12, color: '#6b655b' }}>Имя *
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }} />
          </label>
          <label style={{ fontSize: 12, color: '#6b655b' }}>Роль
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }}>
              <option value="super_admin">Супер-Админ</option>
              <option value="bookkeeper">Бухгалтер</option>
              <option value="logist">Логист</option>
              <option value="supplier_client">Поставщик/заказчик</option>
              <option value="client">Клиент</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: '#6b655b' }}>Компания (для суб-пользователя)
            <select value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }}>
              <option value="">—</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: '#6b655b' }}>Email
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }} />
          </label>
          <label style={{ fontSize: 12, color: '#6b655b' }}>Телефон (+7)
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7" style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }} />
          </label>
          {isNew && (
            <label style={{ fontSize: 12, color: '#6b655b' }}>Пароль
              <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }} />
            </label>
          )}
          <label style={{ fontSize: 12, color: '#6b655b' }}>Slug
            <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }} />
          </label>
          <label style={{ fontSize: 12, color: '#6b655b' }}>Статус
            <select value={form.active ? '1' : '0'} onChange={e => setForm(f => ({ ...f, active: e.target.value === '1' }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }}>
              <option value="1">Активен</option>
              <option value="0">Неактивен</option>
            </select>
          </label>
          {!isNew && subUsers.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6b655b', marginBottom: 6 }}>Суб-пользователи</div>
              {subUsers.map(s => (
                <div key={s.id} style={{ fontSize: 12.5, padding: '6px 0', borderBottom: '1px solid #f1ede7' }}>{s.name} · {s.phone || s.email}</div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <Btn onClick={onClose}>Отмена</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить →'}</Btn>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ data, onGo }: { data: DashboardData | null; onGo: (s: AdminScreen) => void }) {
  if (!data) return <div style={{ padding: 40, color: '#a39c92', textAlign: 'center' }}>Загрузка…</div>
  const { kpi, flow, progress, attention, activity, topClients, specProjects } = data
  const flowItems: [string, number, AdminScreen][] = [
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
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, fontFamily: 'JetBrains Mono, monospace', color: k.color }}>{k.value}</div>
=======
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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
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
<<<<<<< HEAD
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr .9fr', gap: 14 }}>
        <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>Требуют внимания</div>
            <div style={{ fontSize: 11, color: '#a39c92' }}>{attention.length} всего</div>
          </div>
          {attention.length === 0 ? <div style={{ color: '#a39c92', fontSize: 13 }}>Всё в порядке</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attention.map((a, i) => (
                <button key={i} onClick={() => onGo(a.screen as AdminScreen)} style={{ display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left', background: '#faf8f6', border: '1px solid #ece8e2', borderRadius: 8, padding: '9px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: a.hue === '25' ? '#c0392b' : a.hue === '70' ? '#c4a832' : '#3a9d6e', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600 }}>{a.label}</span>
                    <span style={{ display: 'block', fontSize: 11, color: '#8a847c' }}>{a.sub}</span>
                  </span>
                  <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap', background: a.hue === '25' ? '#faeaea' : a.hue === '70' ? '#fdf8e1' : '#e8f5ee', color: a.hue === '25' ? '#b03020' : a.hue === '70' ? '#8a6f00' : '#2e8a5e' }}>{a.tag}</span>
                </button>
              ))}
            </div>
          )}
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
=======

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
              ].filter(Boolean).map(([k, v]) => (
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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
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
<<<<<<< HEAD
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#6b655b' }}>
            <span><b style={{ color: '#d4613a' }}>{progress.inwork}</b> в работе</span>
            <span><b style={{ color: '#3a9d6e' }}>{progress.delivered}</b> доставлено</span>
            <span><b style={{ color: '#c0392b' }}>{progress.overdue}</b> просроч.</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
        <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 14 }}>Поток карточек</div>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
            {flowItems.map(([label, value, scr]) => (
              <button key={label} onClick={() => onGo(scr)} style={{ flex: 1, background: '#faf8f6', border: '1px solid #ece8e2', borderRadius: 9, padding: '13px 8px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
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
                <ProgressBar pct={c.pct} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {specProjects && specProjects.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 14 }}>СпецПроекты · активные</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {specProjects.map(sp => (
              <div key={sp.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600 }}>{sp.name}</span>
                  <span style={{ color: '#8a847c', fontFamily: 'JetBrains Mono, monospace' }}>{sp.pct}% · {sp.cards} карточек</span>
                </div>
                <ProgressBar pct={sp.pct} height={7} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Reception ────────────────────────────────────────────────────────────────

function Reception({ orders, onAction, onOpen, settings, onCreated }: {
  orders: Order[]
  onAction: (id: string, a: string, p?: Record<string, unknown>) => void
  onOpen: (id: string) => void
  settings: SettingsData | null
  onCreated: () => void
}) {
  const waiting = orders.filter(o => o.screen === 'reception' && o.block === 'waiting')
  const processing = orders.filter(o => o.screen === 'reception' && o.block === 'processing')
  const drafts = orders.filter(o => o.isDraft)
  const changedCount = orders.filter(o => o.isChanged && !o.isCancelled && !o.isDraft).length

  const clients = settings?.users.filter(u => isClientRole(u.role)) || []
  const logists = settings?.users.filter(u => u.role === 'logist') || []
  const suppliers = settings?.users.filter(u => u.role === 'supplier_client' && u.active) || []
  const paymentStatuses = settings?.paymentStatuses || []

  const [form, setForm] = useState({
    fromId: '', from: '', to: '', projectId: '', specProjectId: '', contactId: '',
    positions: [emptyPos()],
  })
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const projects = settings?.projects.filter(p => p.status === 'active' && (!form.fromId || !p.clientId || p.clientId === form.fromId)) || []
  const specProjects = settings?.specProjects.filter(p => p.status === 'active' && (!form.fromId || !p.clientId || p.clientId === form.fromId)) || []
  const selectedClient = clients.find(c => c.id === form.fromId)
  const subContacts = settings?.users.filter(u => u.companyId === form.fromId) || []

  async function handleSubmit(isDraft: boolean) {
    if (!form.from) return
    setSubmitting(true)
    try {
      await createOrder({
        from: form.from,
        fromId: form.fromId || undefined,
        to: form.to,
        projectId: form.projectId || undefined,
        specProjectId: form.specProjectId || undefined,
        contactId: form.contactId || undefined,
        positions: form.positions.filter(p => p.name).map((p, i) => ({
          id: `temp-${i}`, cardId: '', oral: p.name, name1c: p.name,
          qty: p.qty, unit: 'шт', price: p.price, resp: p.resp, supplier: p.supplier,
          status: 'В работе', late: false, payment: p.payment,
          deadline: p.deadline || undefined, createdAt: '', updatedAt: '',
        })),
        source: 'admin_manual', isDraft,
      })
      setShowForm(false)
      setForm({ fromId: '', from: '', to: '', projectId: '', specProjectId: '', contactId: '', positions: [emptyPos()] })
      onCreated()
    } finally { setSubmitting(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1180, animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { label: 'В ожидании', value: waiting.length, color: '#d4613a' },
          { label: 'К приёму', value: processing.length, color: '#d4613a' },
          { label: 'Изменено', value: changedCount, color: '#8a6f00' },
          { label: 'Черновики', value: drafts.length, color: '#6b655b' },
        ].map(h => (
          <div key={h.label} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 8, padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#6b655b' }}>{h.label}</span>
            <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: h.color }}>{h.value}</span>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10 }}>
        <button onClick={() => setShowForm(!showForm)} style={{ width: '100%', padding: '14px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', fontFamily: 'inherit', textAlign: 'left' }}>
          <span style={{ color: '#d4613a' }}>＋</span> Создать новый заказ
          <span style={{ fontSize: 11, color: '#a39c92', fontWeight: 400 }}>— ручной ввод, прямой путь в Исходящие</span>
        </button>
        {showForm && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1ede7' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, margin: '14px 0' }}>
              <label style={{ fontSize: 11.5, color: '#6b655b' }}>От кого
                <select value={form.fromId} onChange={e => {
                  const c = clients.find(x => x.id === e.target.value)
                  setForm(f => ({ ...f, fromId: e.target.value, from: c?.name || '', contactId: '', projectId: '', specProjectId: '' }))
                }} style={{ display: 'block', width: '100%', marginTop: 5, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 13 }}>
                  <option value="">Выберите…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 11.5, color: '#6b655b' }}>К кому
                <select value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 5, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 13 }}>
                  <option value="">Выберите…</option>
                  {logists.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 11.5, color: '#6b655b' }}>Контакт
                <select value={form.contactId} onChange={e => setForm(f => ({ ...f, contactId: e.target.value }))} disabled={!selectedClient} style={{ display: 'block', width: '100%', marginTop: 5, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 13 }}>
                  <option value="">—</option>
                  {subContacts.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 11.5, color: '#6b655b' }}>Проект
                <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 5, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 13 }}>
                  <option value="">—</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 11.5, color: '#6b655b' }}>СпецПроект
                <select value={form.specProjectId} onChange={e => setForm(f => ({ ...f, specProjectId: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 5, padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 13 }}>
                  <option value="">—</option>
                  {specProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            </div>
            <div style={{ fontSize: 10, color: '#a39c92', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6, display: 'grid', gridTemplateColumns: '2fr 60px 80px 100px 100px 90px 28px 28px 28px', gap: 7 }}>
              <span>Наим-ние</span><span>Кол-во</span><span>Цена(тг)</span><span>Логист</span><span>Поставщик</span><span>Срок</span><span>💳</span><span>📋</span><span />
            </div>
            {form.positions.map((pos, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: pos.showPayment ? '2fr 60px 80px 100px 100px 90px 90px 28px 28px 28px' : '2fr 60px 80px 100px 100px 90px 28px 28px 28px', gap: 7, alignItems: 'center', marginBottom: 8 }}>
                <input placeholder="Наименование…" value={pos.name} onChange={e => setForm(f => ({ ...f, positions: f.positions.map((p, j) => j === i ? { ...p, name: e.target.value } : p) }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 12.5 }} />
                <input type="number" value={pos.qty} onChange={e => setForm(f => ({ ...f, positions: f.positions.map((p, j) => j === i ? { ...p, qty: +e.target.value } : p) }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 12.5 }} />
                <input type="number" value={pos.price || ''} onChange={e => setForm(f => ({ ...f, positions: f.positions.map((p, j) => j === i ? { ...p, price: +e.target.value } : p) }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 12.5 }} />
                <select value={pos.resp} onChange={e => setForm(f => ({ ...f, positions: f.positions.map((p, j) => j === i ? { ...p, resp: e.target.value } : p) }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 12 }}>
                  <option value="">Логист</option>
                  {logists.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
                <select value={pos.supplier} onChange={e => setForm(f => ({ ...f, positions: f.positions.map((p, j) => j === i ? { ...p, supplier: e.target.value } : p) }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 12 }}>
                  <option value="">Поставщик</option>
                  {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                <input type="date" value={pos.deadline} onChange={e => setForm(f => ({ ...f, positions: f.positions.map((p, j) => j === i ? { ...p, deadline: e.target.value } : p) }))} style={{ padding: 7, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 12 }} />
                {pos.showPayment && (
                  <select value={pos.payment} onChange={e => setForm(f => ({ ...f, positions: f.positions.map((p, j) => j === i ? { ...p, payment: e.target.value } : p) }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 12 }}>
                    {paymentStatuses.map(ps => <option key={ps.id} value={ps.name}>{ps.name}</option>)}
                  </select>
                )}
                <button onClick={() => setForm(f => ({ ...f, positions: f.positions.map((p, j) => j === i ? { ...p, showPayment: !p.showPayment } : p) }))} style={{ width: 28, height: 28, border: '1px solid #d8d3cc', background: pos.showPayment ? '#fff0ea' : '#fff', borderRadius: 7, cursor: 'pointer' }} title="Оплата">💳</button>
                <button onClick={() => copyText(pos.name)} style={{ width: 28, height: 28, border: '1px solid #d8d3cc', background: '#fff', borderRadius: 7, cursor: 'pointer' }}>📋</button>
                <button onClick={() => setForm(f => ({ ...f, positions: f.positions.length > 1 ? f.positions.filter((_, j) => j !== i) : [emptyPos()] }))} style={{ width: 28, height: 28, border: '1px solid #e6dcd6', background: '#fff', borderRadius: 7, cursor: 'pointer', color: '#b03020' }}>🗑</button>
              </div>
            ))}
            <button onClick={() => setForm(f => ({ ...f, positions: [...f.positions, emptyPos()] }))} style={{ background: 'none', border: '1px dashed #d8d3cc', color: '#6b655b', padding: '7px 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>＋ Добавить позицию</button>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <Btn onClick={() => handleSubmit(true)}>Сохранить черновик</Btn>
              <Btn variant="primary" onClick={() => handleSubmit(false)} disabled={submitting}>{submitting ? 'Отправка…' : 'ОТПРАВИТЬ ЗАКАЗ →'}</Btn>
            </div>
          </div>
        )}
      </div>

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
                <span style={statusStyle(card.status)}>{card.status}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
                {card.positions.map(p => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 16px 1.4fr 60px 80px 100px 100px 90px', gap: 8, alignItems: 'center' }}>
                    <div style={{ background: '#fdf8e1', border: '1px solid #e8d87a', color: '#8a6f00', padding: '7px 9px', borderRadius: 6, fontSize: 12 }}>{p.oral || '—'}</div>
                    <div style={{ textAlign: 'center', color: '#b8b1a6' }}>→</div>
                    <input placeholder="Наименование 1С…" defaultValue={p.name1c} style={{ padding: '7px 9px', border: '1px solid #ddd8d0', borderRadius: 6, fontFamily: 'inherit', fontSize: 12 }} />
                    <input defaultValue={p.qty} style={{ padding: 7, border: '1px solid #ddd8d0', borderRadius: 6, fontFamily: 'inherit', fontSize: 12 }} />
                    <input defaultValue={p.price} style={{ padding: 7, border: '1px solid #ddd8d0', borderRadius: 6, fontFamily: 'inherit', fontSize: 12 }} />
                    <select defaultValue={p.resp} style={{ padding: 7, border: '1px solid #ddd8d0', borderRadius: 6, fontFamily: 'inherit', fontSize: 12 }}>
                      <option value="">Логист</option>
                      {logists.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                    <select defaultValue={p.supplier} style={{ padding: 7, border: '1px solid #ddd8d0', borderRadius: 6, fontFamily: 'inherit', fontSize: 12 }}>
                      <option value="">Поставщик</option>
                      {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                    <input type="date" defaultValue={p.deadline?.slice(0, 10)} style={{ padding: 6, border: '1px solid #ddd8d0', borderRadius: 6, fontFamily: 'inherit', fontSize: 11 }} />
=======
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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
                  </div>
                ) : (
                  <button onClick={() => setShowCanc(true)} style={{ padding: '10px 16px', background: '#faeaea', color: '#b03020', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✗ Отменить
                  </button>
                )}
              </div>
<<<<<<< HEAD
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Btn onClick={() => onAction(card.id, 'returnOut')}>← Вернуть</Btn>
                <Btn variant="primary" onClick={() => onAction(card.id, 'process')}>ОТПРАВИТЬ В ИСХОДЯЩИЕ →</Btn>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          Ожидание <span style={{ background: '#fff0ea', color: '#c0532a', fontSize: 11, padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>{waiting.length}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 12 }}>
          {waiting.map(card => (
            <div key={card.id} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 12.5 }}>{card.id}</span>
                <span style={sourceStyle(card.source)}>{sourceLabel(card.source)}</span>
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
                  <Btn size="sm" onClick={() => onOpen(card.id)}>Доработать</Btn>
                  <Btn size="sm" onClick={() => onAction(card.id, 'accept')}>Отправить</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
=======
            ) : (
              <button key={a.action} onClick={() => onAction(a.action)} style={{
                flex: 1, padding: '10px 16px', background: a.color || '#f1efec', color: a.color ? '#fff' : '#26231f',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{a.label}</button>
            )
          ))}
        </div>
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
      )}
    </div>
  )
}

<<<<<<< HEAD
// ─── Incoming ─────────────────────────────────────────────────────────────────

function Incoming({ orders, tab, setTab, onAction, onOpen }: {
  orders: Order[]
  tab: IncTab
  setTab: (t: IncTab) => void
  onAction: (id: string, a: string, p?: Record<string, unknown>) => void
  onOpen: (id: string) => void
}) {
  const inc = orders.filter(o => o.screen === 'incoming')
  const newCards = inc.filter(o => !o.isDraft && !o.isCancelled && !o.toacc && (o.status === 'В ожидании' || o.status === 'Новая заявка'))
  const changed = orders.filter(o => o.isChanged && !o.isCancelled && !o.isDraft)
  const toacc = inc.filter(o => o.toacc && o.status === 'Доставлено')
  const drafts = orders.filter(o => o.isDraft)
  const cancelled = orders.filter(o => o.isCancelled)
  const tabs: [IncTab, string, Order[]][] = [
    ['new', 'Новые', newCards], ['changed', 'Изменённые', changed],
    ['toacc', 'К учёту', toacc], ['drafts', 'Черновики', drafts], ['cancelled', 'Отменённые', cancelled],
  ]
  const list = tabs.find(t => t[0] === tab)?.[2] || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1080, animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e6e2dc' }}>
        {tabs.map(([id, label, items]) => (
          <TabBtn key={id} active={tab === id} onClick={() => setTab(id)}>
            {label}{' '}
            <span style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', padding: '0 6px', borderRadius: 20, background: tab === id ? '#fff0ea' : '#f1ede7', color: tab === id ? '#c0532a' : '#8a847c' }}>{items.length}</span>
          </TabBtn>
        ))}
      </div>
      {list.length === 0 && <div style={{ color: '#a39c92', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>Нет карточек в этой вкладке</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {list.map(card => (
          <div key={card.id} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 15, opacity: card.postponed ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 13 }}>{card.id}</span>
                  <span style={statusStyle(card.status)}>{card.status}</span>
                  {card.isChanged && <span style={{ background: '#fdf8e1', color: '#8a6f00', fontSize: 10.5, padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>изменено</span>}
                  {card.postponed && <span style={{ background: '#efece8', color: '#8a847c', fontSize: 10.5, padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>отложено</span>}
                  <span style={sourceStyle(card.source)}>{sourceLabel(card.source)}</span>
                </div>
                <div style={{ fontSize: 13, color: '#3a352f', marginBottom: 3 }}>{card.from} → {card.to || '—'}</div>
                <div style={{ fontSize: 12, color: '#8a847c', marginBottom: 3 }}>{(card.comment || '').slice(0, 110)}</div>
                {card.isChanged && <div style={{ fontSize: 12, color: '#8a6f00', background: '#fdf8e1', border: '1px solid #e8d87a', borderRadius: 7, padding: '8px 10px', margin: '6px 0' }}>✎ {card.changeText} · тел. {card.changePhone}</div>}
                <div style={{ fontSize: 11, color: '#b8b1a6' }}>{fmtDateTime(card.createdAt)} · позиций: {card.positions.length}{card.toacc ? ` · сумма ${fmtMoney(cardSum(card))}` : ''}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-end' }}>
                <button onClick={() => copyText(`${window.location.origin}/track?id=${card.id}`)} title="Скопировать ссылку" style={{ width: 34, height: 34, border: '1px solid #e0dcd5', background: '#fff', borderRadius: 7, cursor: 'pointer', color: '#6b655b' }}>📎</button>
                <Btn size="sm" onClick={() => onOpen(card.id)}>Открыть</Btn>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12, borderTop: '1px solid #f1ede7', paddingTop: 12 }}>
              {tab === 'new' && <>
                <Btn onClick={() => onAction(card.id, 'postpone')}>Отложить</Btn>
                <Btn variant="danger" onClick={() => onAction(card.id, 'cancel')}>Отменить</Btn>
                <Btn variant="primary" onClick={() => onAction(card.id, 'accept')}>ПРИНЯТЬ →</Btn>
              </>}
              {tab === 'changed' && <>
                <Btn variant="danger" onClick={() => onAction(card.id, 'cancel')}>Отклонить</Btn>
                <Btn variant="primary" onClick={() => onAction(card.id, 'confirmChg')}>✓ Принять изменения</Btn>
              </>}
              {tab === 'toacc' && <>
                <Btn onClick={() => onAction(card.id, 'returnOut')}>← В Исходящие</Btn>
                <Btn variant="primary" onClick={() => onAction(card.id, 'sendAcc')}>Отправить в К Учёту →</Btn>
              </>}
              {tab === 'drafts' && <>
                <Btn onClick={() => onOpen(card.id)}>Доработать</Btn>
                <Btn onClick={() => onAction(card.id, 'accept')}>Отправить</Btn>
              </>}
              {tab === 'cancelled' && <>
                <span style={{ fontSize: 12, color: '#a39c92', alignSelf: 'center', marginRight: 'auto' }}>Причина: {card.cancelReason || '—'}</span>
                <Btn onClick={() => onAction(card.id, 'restore')}>↺ Восстановить</Btn>
              </>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Outgoing ─────────────────────────────────────────────────────────────────

function Outgoing({ orders, tab, setTab, onAction, onOpen }: {
  orders: Order[]
  tab: OutgoingTab
  setTab: (t: OutgoingTab) => void
  onAction: (id: string, a: string, p?: Record<string, unknown>) => void
  onOpen: (id: string) => void
}) {
  const all = orders.filter(o => o.screen === 'outgoing' && o.status === 'В работе')
  const inwork = all.filter(o => cardProgress(o) < 60)
  const ready = all.filter(o => cardProgress(o) >= 60 && !isOverdue(o))
  const tabs: [OutgoingTab, string, Order[]][] = [
    ['inwork', 'В работе', inwork],
    ['ready', 'Готово к доставке', ready],
    ['all', 'Все', all],
  ]
  const list = tabs.find(t => t[0] === tab)?.[2] || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1080, animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e6e2dc' }}>
        {tabs.map(([id, label, items]) => (
          <TabBtn key={id} active={tab === id} onClick={() => setTab(id)}>
            {label}{' '}
            <span style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', padding: '0 6px', borderRadius: 20, background: tab === id ? '#fff0ea' : '#f1ede7', color: tab === id ? '#c0532a' : '#8a847c' }}>{items.length}</span>
          </TabBtn>
        ))}
      </div>
      {list.length === 0 && <div style={{ color: '#a39c92', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>Активных заказов нет</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map(card => {
          const prog = cardProgress(card)
          const over = isOverdue(card)
          const readyTag = prog >= 60 && !over
          const tagStyle: React.CSSProperties = over
            ? { background: '#faeaea', color: '#b03020' }
            : readyTag
              ? { background: '#fdf8e1', color: '#8a6f00' }
              : { background: '#fff0ea', color: '#c0532a' }
          const tag = over ? '⚠ Просрочено' : readyTag ? '✓ Готово к доставке' : 'В работе'
          return (
            <div key={card.id} style={{ background: '#fff', border: `1px solid ${over ? '#e8a0a0' : '#e6e2dc'}`, borderRadius: 10, padding: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 13 }}>{card.id}</span>
                    <span style={{ ...tagStyle, fontSize: 10.5, padding: '1px 9px', borderRadius: 20, fontWeight: 600 }}>{tag}</span>
                    {card.isChanged && <span style={{ background: '#fdf8e1', color: '#8a6f00', fontSize: 10.5, padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>изменено клиентом</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#6b655b' }}>{card.from} → {card.to} · срок {fmtDate(card.deadline)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#a39c92' }}>прогресс</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{prog}%</div>
                </div>
              </div>
              <ProgressBar pct={prog} height={6} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
                {card.positions.map(p => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr 160px', gap: 10, alignItems: 'center', padding: '7px 10px', background: '#faf8f6', borderRadius: 7 }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{p.name1c || p.oral || '—'}</div>
                      <div style={{ fontSize: 11, color: '#a39c92' }}>{p.qty} {p.unit} · {p.resp || '—'}{p.supplier ? ` · ${p.supplier}` : ''}</div>
                    </div>
                    <ProgressBar pct={posPct(p)} height={5} />
                    <select value={p.status} onChange={e => onAction(card.id, 'updatePos', { posId: p.id, status: e.target.value })} style={{ padding: '6px 8px', border: '1px solid #ddd8d0', borderRadius: 6, fontFamily: 'inherit', fontSize: 12, background: '#fff' }}>
                      {POS_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #f1ede7', paddingTop: 12 }}>
                <span style={{ fontSize: 12, color: '#8a847c', marginRight: 'auto' }}>Сумма: <b>{fmtMoney(cardSum(card))}</b></span>
                <Btn size="sm" onClick={() => onOpen(card.id)}>Открыть</Btn>
                <Btn size="sm" onClick={() => copyText(`${window.location.origin}/track?id=${card.id}`)}>📎 Ссылка клиенту</Btn>
                <Btn size="sm" onClick={() => onAction(card.id, 'returnOut')}>← Вернуть</Btn>
                <Btn variant="primary" onClick={() => onAction(card.id, 'markAll')}>✓ Всё выполнено</Btn>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Filter Kanban (dnd-kit) ──────────────────────────────────────────────────

function KanbanCard({ card, onOpen }: { card: Order; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const prog = cardProgress(card)
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: '#fff',
    border: '1px solid #e6e2dc',
    borderRadius: 8,
    padding: 11,
    cursor: 'grab',
    marginBottom: 8,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={() => onOpen(card.id)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 12 }}>{card.id}</span>
        <span style={statusStyle(card.status)}>{card.status}</span>
      </div>
      <div style={{ fontSize: 11.5, color: '#8a847c', marginBottom: 8 }}>→ {card.to || '—'}</div>
      <ProgressBar pct={prog} />
    </div>
  )
}

function KanbanColumn({ colId, title, cards, onOpen, estimate }: {
  colId: string
  title: string
  cards: Order[]
  onOpen: (id: string) => void
  estimate?: { items: Array<{ name: string; need: number; got: number; unit: string }>; overallPct: number }
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colId })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    flexShrink: 0,
    width: 280,
    background: '#ece8e2',
    borderRadius: 10,
    padding: 11,
    maxHeight: 'calc(100vh - 200px)',
    display: 'flex',
    flexDirection: 'column',
  }
  return (
    <div ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 5px 10px', cursor: 'grab' }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{title}</span>
        <span style={{ background: '#fff', color: '#6b655b', fontSize: 11, padding: '1px 9px', borderRadius: 20, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{cards.length}</span>
      </div>
      {estimate && estimate.items.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 11 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#6b655b' }}>СМЕТА vs СОБРАНО</div>
          {estimate.items.slice(0, 4).map(it => {
            const pct = it.need > 0 ? Math.min(100, Math.round((it.got / it.need) * 100)) : 0
            return (
              <div key={it.name} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span>{it.name}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#8a847c' }}>{it.got}/{it.need} {it.unit}</span>
                </div>
                <ProgressBar pct={pct} height={4} />
              </div>
            )
          })}
          <div style={{ marginTop: 8, fontSize: 11, color: '#6b655b' }}>Общий: <b>{estimate.overallPct}%</b></div>
        </div>
      )}
      <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {cards.map(card => <KanbanCard key={card.id} card={card} onOpen={onOpen} />)}
        </div>
      </SortableContext>
    </div>
  )
}

type FilterColKey = string

function FilterMultiSelect({ label, options, selected, onChange }: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const allSelected = options.length > 0 && selected.length === options.length
  const summary = selected.length === 0
    ? 'Выберите…'
    : allSelected
      ? 'Все'
      : selected.length === 1
        ? (options.find(o => o.value === selected[0])?.label || selected[0])
        : `${selected.length} выбрано`

  function toggleAll() {
    onChange(allSelected ? [] : options.map(o => o.value))
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #d8d3cc', background: '#fff', color: '#6b655b', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, minWidth: 150, textAlign: 'left' }}
      >
        {label}: {summary}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: 4, background: '#fff', border: '1px solid #e6e2dc', borderRadius: 9, padding: 8, minWidth: 220, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 24px rgba(33,31,28,.12)' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid #f1ede7', marginBottom: 4 }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            Все
          </label>
          {options.map(o => (
            <label key={o.value} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 8px', fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => onChange(selected.includes(o.value) ? selected.filter(v => v !== o.value) : [...selected, o.value])}
              />
              {o.label}
            </label>
          ))}
          {options.length === 0 && <div style={{ padding: 8, fontSize: 12, color: '#a39c92' }}>Нет данных</div>}
        </div>
      )}
    </div>
  )
}

function orderMatchesFilterCol(order: Order, colKey: FilterColKey, settings: SettingsData | null): boolean {
  if (!settings) return false
  const [type, val] = colKey.split('::')
  if (type === 'sup') return order.positions.some(p => p.supplier === val)
  if (type === 'cust') {
    const u = settings.users.find(x => x.name === val && x.role === 'supplier_client')
    return order.from === val || (!!u && order.fromId === u.id)
  }
  if (type === 'priv') {
    const u = settings.users.find(x => x.name === val && x.role === 'client')
    return order.from === val || (!!u && order.fromId === u.id)
  }
  if (type === 'proj') return order.projectId === val
  if (type === 'spec') return order.specProjectId === val
  return false
}

function FilterKanban({ orders, selections, setSelections, statusFilter, setStatusFilter, onOpen, settings }: {
  orders: Order[]
  selections: AdminFilterSelections
  setSelections: (s: AdminFilterSelections) => void
  statusFilter: FilterStatus
  setStatusFilter: (s: FilterStatus) => void
  onOpen: (id: string) => void
  settings: SettingsData | null
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const boardBase = useMemo(() => orders.filter(o =>
    !o.isDraft && !o.isCancelled && o.screen !== 'bookkeeping' && o.screen !== 'archive'
  ), [orders])

  const board = useMemo(() => {
    if (statusFilter === 'inwork') return boardBase.filter(o => o.screen !== 'archive' && cardProgress(o) < 100 && o.status !== 'Доставлено')
    if (statusFilter === 'delivered') return boardBase.filter(o => o.status === 'Доставлено' || o.toacc || cardProgress(o) === 100)
    return boardBase
  }, [boardBase, statusFilter])

  const users = settings?.users || []

  const selectedClientIds = useMemo(() => {
    const ids = new Set<string>()
    selections.customers.forEach(name => {
      const u = users.find(x => x.name === name && x.role === 'supplier_client')
      if (u) ids.add(u.id)
    })
    selections.privateClients.forEach(name => {
      const u = users.find(x => x.name === name && x.role === 'client')
      if (u) ids.add(u.id)
    })
    return ids
  }, [selections.customers, selections.privateClients, users])

  const filterOptions = useMemo(() => ({
    suppliers: users.filter(u => u.active && u.role === 'supplier_client').map(u => ({ value: u.name, label: u.name })),
    customers: users.filter(u => u.active && u.role === 'supplier_client').map(u => ({ value: u.name, label: u.name })),
    privateClients: users.filter(u => u.active && u.role === 'client').map(u => ({ value: u.name, label: u.name })),
    projects: (settings?.projects || [])
      .filter(p => p.status === 'active' && (selectedClientIds.size === 0 || !p.clientId || selectedClientIds.has(p.clientId)))
      .map(p => ({ value: p.id, label: p.name })),
    specProjects: (settings?.specProjects || [])
      .filter(p => p.status === 'active' && (selectedClientIds.size === 0 || !p.clientId || selectedClientIds.has(p.clientId)))
      .map(p => ({ value: p.id, label: p.name })),
  }), [users, settings, selectedClientIds])

  const columns = useMemo((): { key: FilterColKey; title: string; specId?: string }[] => {
    const cols: { key: FilterColKey; title: string; specId?: string }[] = []
    selections.suppliers.forEach(v => cols.push({ key: `sup::${v}`, title: v }))
    selections.customers.forEach(v => cols.push({ key: `cust::${v}`, title: v }))
    selections.privateClients.forEach(v => cols.push({ key: `priv::${v}`, title: v }))
    selections.projects.forEach(v => {
      const p = settings?.projects.find(x => x.id === v)
      cols.push({ key: `proj::${v}`, title: p?.name || v })
    })
    selections.specProjects.forEach(v => {
      const p = settings?.specProjects.find(x => x.id === v)
      cols.push({ key: `spec::${v}`, title: p?.name || v, specId: v })
    })
    return cols
  }, [selections, settings])

  const hasSelection = columns.length > 0

  const grouped = useMemo(() => {
    const map: Record<FilterColKey, Order[]> = {}
    if (!hasSelection) return map
    columns.forEach(c => { map[c.key] = [] })
    board.forEach(o => {
      columns.forEach(c => {
        if (orderMatchesFilterCol(o, c.key, settings)) {
          map[c.key].push(o)
        }
      })
    })
    return map
  }, [board, columns, hasSelection, settings])

  const [columnOrder, setColumnOrder] = useState<FilterColKey[]>([])
  const [cardOrders, setCardOrders] = useState<Record<FilterColKey, string[]>>({})

  useEffect(() => {
    const keys = columns.map(c => c.key)
    setColumnOrder(keys)
    const co: Record<FilterColKey, string[]> = {}
    keys.forEach(k => { co[k] = (grouped[k] || []).map(o => o.id) })
    setCardOrders(co)
  }, [grouped, columns])

  function getSpecEstimate(specId: string | undefined) {
    if (!specId || !settings) return undefined
    const sp = settings.specProjects.find(s => s.id === specId)
    if (!sp) return undefined
    const linked = board.filter(o => o.specProjectId === sp.id)
    const items = sp.items.map(it => {
      let got = 0
      linked.forEach(o => o.positions.forEach(p => {
        if ((p.name1c || p.oral) === it.name) got += p.qty
      }))
      return { name: it.name, need: it.qty, got, unit: it.unit }
    })
    const overallPct = items.length
      ? Math.round(items.reduce((s, it) => s + (it.need > 0 ? Math.min(100, (it.got / it.need) * 100) : 0), 0) / items.length)
      : 0
    return { items, overallPct }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)

    if (columnOrder.includes(activeId)) {
      const oldIndex = columnOrder.indexOf(activeId)
      const newIndex = columnOrder.indexOf(overId)
      if (oldIndex >= 0 && newIndex >= 0) {
        setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex))
      }
      return
    }

    for (const col of Object.keys(cardOrders)) {
      const ids = cardOrders[col]
      if (ids.includes(activeId) && ids.includes(overId)) {
        const next = arrayMove(ids, ids.indexOf(activeId), ids.indexOf(overId))
        setCardOrders(prev => ({ ...prev, [col]: next }))
        break
      }
    }
  }

  const statuses: [FilterStatus, string][] = [['inwork', 'В работе'], ['delivered', 'Доставлено'], ['all', 'Все']]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <FilterMultiSelect label="Поставщики" options={filterOptions.suppliers} selected={selections.suppliers}
          onChange={suppliers => setSelections({ ...selections, suppliers })} />
        <FilterMultiSelect label="Заказчики" options={filterOptions.customers} selected={selections.customers}
          onChange={customers => setSelections({ ...selections, customers })} />
        <FilterMultiSelect label="Частные клиенты" options={filterOptions.privateClients} selected={selections.privateClients}
          onChange={privateClients => setSelections({ ...selections, privateClients })} />
        <FilterMultiSelect label="Проекты" options={filterOptions.projects} selected={selections.projects}
          onChange={projects => setSelections({ ...selections, projects })} />
        <FilterMultiSelect label="СпецПроекты" options={filterOptions.specProjects} selected={selections.specProjects}
          onChange={specProjects => setSelections({ ...selections, specProjects })} />
        <div style={{ display: 'flex', gap: 4 }}>
          {statuses.map(([s, label]) => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid ${statusFilter === s ? '#d4613a' : '#d8d3cc'}`, background: statusFilter === s ? '#fff0ea' : '#fff', color: statusFilter === s ? '#c0532a' : '#6b655b', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>{label}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#8a847c' }}>
          {hasSelection ? `${board.length} карточек · ${columnOrder.length} колонок` : 'Выберите фильтры'}
        </div>
      </div>

      {!hasSelection ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a39c92', fontSize: 14, padding: 40 }}>
          Экран пуст — выберите поставщиков, заказчиков, клиентов или проекты из списков выше
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
            <div style={{ flex: 1, display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 10, alignItems: 'flex-start' }}>
              {columnOrder.map(colKey => {
                const col = columns.find(c => c.key === colKey)
                const ids = cardOrders[colKey] || []
                const cards = ids.map(id => board.find(o => o.id === id)).filter(Boolean) as Order[]
                return (
                  <KanbanColumn
                    key={colKey}
                    colId={colKey}
                    title={col?.title || colKey}
                    cards={cards}
                    onOpen={onOpen}
                    estimate={col?.specId ? getSpecEstimate(col.specId) : undefined}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

// ─── Accounting ─────────────────────────────────────────────────────────────────

function Accounting({ orders, onAction, onOpen, onPostAll }: {
  orders: Order[]
  onAction: (id: string, a: string, p?: Record<string, unknown>) => void
  onOpen: (id: string) => void
  onPostAll: () => void
}) {
  const cards = orders.filter(o => o.screen === 'accounting' && o.status === 'К учёту')
  const postedToday = orders.filter(o => o.screen === 'bookkeeping' && o.updatedAt && new Date(o.updatedAt).toDateString() === new Date().toDateString()).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1000, animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: '#fff', border: '1px solid #e6e2dc', borderRadius: 9, padding: '11px 16px' }}>
        <span style={{ fontSize: 12.5, color: '#6b655b' }}>На рассмотрении: <b style={{ fontFamily: 'JetBrains Mono, monospace', color: '#c0532a' }}>{cards.length}</b></span>
        <span style={{ fontSize: 12.5, color: '#6b655b' }}>Проведено сегодня: <b style={{ fontFamily: 'JetBrains Mono, monospace', color: '#3a9d6e' }}>{postedToday}</b></span>
        {cards.length > 0 && <span style={{ marginLeft: 'auto' }}><Btn variant="primary" onClick={onPostAll}>Все в Бухгалтерию →</Btn></span>}
      </div>
      {cards.length === 0 && <div style={{ color: '#a39c92', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>Нет карточек на рассмотрении</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {cards.map(card => (
          <div key={card.id} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 15, opacity: card.postponed ? 0.6 : 1 }}>
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
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 28px', gap: 8, alignItems: 'center', padding: '6px 10px', background: '#faf8f6', borderRadius: 7 }}>
                  <span style={{ fontSize: 12.5 }}>{p.name1c || p.oral || '—'}</span>
                  <span style={{ fontSize: 12, color: '#6b655b', fontFamily: 'JetBrains Mono, monospace' }}>{p.qty} {p.unit}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(p.qty * p.price)}</span>
                  <button onClick={() => copyText(p.name1c || p.oral)} style={{ width: 28, height: 28, border: '1px solid #d8d3cc', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>📋</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #f1ede7', paddingTop: 12 }}>
              <Btn onClick={() => onAction(card.id, 'returnOut')}>← Вернуть в Исходящие</Btn>
              <Btn variant="primary" onClick={() => onAction(card.id, 'postAcc')}>Провести → Бухгалтерия</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Warehouse ────────────────────────────────────────────────────────────────

function Warehouse() {
  const [stock, setStock] = useState<Stock[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [movTab, setMovTab] = useState<'all' | 'reserve' | 'income' | 'expense'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchStock(), fetchStockMovements()])
      .then(([s, m]) => { setStock(s); setMovements(m) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filteredMov = movements.filter(m => movTab === 'all' || m.type === movTab)
  const reserveCount = movements.filter(m => m.type === 'reserve').length
  const incomeCount = movements.filter(m => m.type === 'income').length
  const expenseCount = movements.filter(m => m.type === 'expense').length
  const totalReserve = stock.reduce((s, x) => s + x.reserved, 0)

  if (loading) return <div style={{ padding: 40, color: '#a39c92', textAlign: 'center' }}>Загрузка…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100, animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Позиций', value: stock.length },
          { label: 'Резервы', value: totalReserve },
          { label: 'Приход', value: incomeCount },
          { label: 'Расход', value: expenseCount },
        ].map(h => (
          <div key={h.label} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 8, padding: '10px 16px' }}>
            <div style={{ fontSize: 11, color: '#8a847c' }}>{h.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#d4613a' }}>{h.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', fontWeight: 700, borderBottom: '1px solid #f1ede7' }}>Остатки · Центр Склад</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#faf8f6', borderBottom: '1px solid #eee8e1' }}>
              {['Номенклатура', 'Ед.', 'На складе', 'Резерв', 'Доступно'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10.5, color: '#a39c92', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stock.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f4f1ec' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{s.name}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', color: '#6b655b' }}>{s.unit}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace' }}>{s.qty}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', color: '#c0532a' }}>{s.reserved}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', color: '#2e8a5e', fontWeight: 600 }}>{s.qty - s.reserved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 4, padding: '10px 16px', borderBottom: '1px solid #f1ede7' }}>
          {([
            ['all', `Все ${movements.length}`],
            ['reserve', `Резервы ${reserveCount}`],
            ['income', `Приход ${incomeCount}`],
            ['expense', `Расход ${expenseCount}`],
          ] as const).map(([id, label]) => (
            <button key={id} onClick={() => setMovTab(id)} style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${movTab === id ? '#d4613a' : '#d8d3cc'}`, background: movTab === id ? '#fff0ea' : '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: movTab === id ? '#c0532a' : '#6b655b' }}>{label}</button>
          ))}
        </div>
        <div style={{ padding: '8px 0' }}>
          {filteredMov.length === 0 ? (
            <div style={{ padding: 20, color: '#a39c92', textAlign: 'center' }}>Нет записей</div>
          ) : filteredMov.map(m => (
            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 120px 80px 100px', gap: 12, padding: '10px 16px', borderBottom: '1px solid #f4f1ec', fontSize: 12.5 }}>
              <span style={{ fontWeight: 600, color: m.type === 'reserve' ? '#c0532a' : m.type === 'income' ? '#2e8a5e' : '#b03020' }}>{m.type}</span>
              <span>{m.name}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#6b655b' }}>{m.cardId || '—'}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{m.qty} {m.unit}</span>
              <span style={{ color: '#a39c92' }}>{fmtDate(m.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Bookkeeping ──────────────────────────────────────────────────────────────

function BookkeepingScreen({ orders, tab, setTab, onAction, onOpen, reports, onReportAction }: {
  orders: Order[]
  tab: BookkeepingTab
  setTab: (t: BookkeepingTab) => void
  onAction: (id: string, a: string, p?: Record<string, unknown>) => void
  onOpen: (id: string) => void
  reports: DailyReport[]
  onReportAction: (id: string, status: string) => void
}) {
  const cards = orders.filter(o => o.screen === 'bookkeeping')
  const posted = cards.filter(o => o.posted1C).length
  const archive = orders.filter(o => o.screen === 'archive').length
  const [expandedReport, setExpandedReport] = useState<string | null>(null)

  const chip = (on: boolean) => ({
    fontSize: 10.5, padding: '2px 9px', borderRadius: 20, fontWeight: 600,
    background: on ? '#e8f5ee' : '#f1ede7', color: on ? '#2e8a5e' : '#a39c92',
  } as React.CSSProperties)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1000, animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e6e2dc' }}>
        <TabBtn active={tab === 'cards'} onClick={() => setTab('cards')}>
          Карточки <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, marginLeft: 4 }}>{cards.length}</span>
        </TabBtn>
        <TabBtn active={tab === 'reports'} onClick={() => setTab('reports')}>
          Ежедневный отчёт <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, marginLeft: 4 }}>{reports.length}</span>
        </TabBtn>
      </div>

      {tab === 'cards' && (
        <>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#fff', border: '1px solid #e6e2dc', borderRadius: 9, padding: '11px 16px' }}>
            <span style={{ fontSize: 12.5, color: '#6b655b' }}>В работе: <b style={{ fontFamily: 'JetBrains Mono, monospace', color: '#c0532a' }}>{cards.length}</b></span>
            <span style={{ fontSize: 12.5, color: '#6b655b' }}>Проведено в 1С: <b style={{ fontFamily: 'JetBrains Mono, monospace', color: '#2e8a5e' }}>{posted}</b></span>
            <span style={{ fontSize: 12.5, color: '#6b655b' }}>В архиве: <b style={{ fontFamily: 'JetBrains Mono, monospace' }}>{archive}</b></span>
          </div>
          {cards.length === 0 && <div style={{ color: '#a39c92', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>Нет карточек в бухгалтерии</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cards.map(card => (
              <div key={card.id} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 11 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 13 }}>{card.id}</span>
                      <span style={chip(card.invoice)}>{card.invoice ? '✓ ' : ''}Счёт</span>
                      <span style={chip(card.fact)}>{card.fact ? '✓ ' : ''}Счёт-фактура</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: '#6b655b' }}>{card.from} → {card.to} · доставлено {fmtDate(card.delivered)} · позиций {card.positions.length}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#a39c92' }}>сумма</div>
                    <div style={{ fontSize: 19, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(cardSum(card))}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #f1ede7', paddingTop: 12, flexWrap: 'wrap' }}>
                  <Btn size="sm" onClick={() => onAction(card.id, 'createDoc', { type: 'invoice' })}>📄 Счёт</Btn>
                  <Btn size="sm" onClick={() => onAction(card.id, 'createDoc', { type: 'fact' })}>📄 Счёт-фактура</Btn>
                  <Btn size="sm" onClick={() => onOpen(card.id)}>Открыть</Btn>
                  <span style={{ flex: 1 }} />
                  <Btn size="sm" onClick={() => onAction(card.id, 'returnToAcc')}>← В К Учёту</Btn>
                  <Btn size="sm" onClick={() => onAction(card.id, 'post1C')} variant={card.posted1C ? 'default' : 'primary'}>
                    {card.posted1C ? '✓ Проведено в 1С' : 'Провести в 1С'}
                  </Btn>
                  {card.posted1C && <Btn variant="dark" size="sm" onClick={() => onAction(card.id, 'sendArchive')}>В Архив →</Btn>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.length === 0 && <div style={{ color: '#a39c92', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>Нет отчётов</div>}
          {reports.map(r => {
            const open = expandedReport === r.id
            const statusColor = r.status === 'done' ? '#2e8a5e' : r.status === 'archive' ? '#6b655b' : '#c0532a'
            const statusLabel = r.status === 'done' ? 'Готово' : r.status === 'archive' ? 'Архив' : 'В обработке'
            return (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, overflow: 'hidden' }}>
                <button onClick={() => setExpandedReport(open ? null : r.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ fontWeight: 600 }}>{fmtDate(r.date)}</span>
                  <span style={{ color: '#6b655b' }}>{r.logist?.name || 'Логист'}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 9px', borderRadius: 20, fontWeight: 600, background: '#fff0ea', color: statusColor }}>{statusLabel}</span>
                </button>
                {open && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1ede7' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginTop: 12 }}>
                      <thead>
                        <tr style={{ background: '#faf8f6' }}>
                          {['От кого', 'Наим', 'Шт', 'Комм', 'К кому', 'Шт', 'Комм', '№ накл'].map(h => (
                            <th key={h} style={{ padding: '8px 6px', textAlign: 'left', color: '#a39c92', fontSize: 10, fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {r.rows.map(row => (
                          <tr key={row.id} style={{ borderBottom: '1px solid #f4f1ec' }}>
                            <td style={{ padding: '8px 6px' }}>{row.fromWho}</td>
                            <td style={{ padding: '8px 6px' }}>{row.name}</td>
                            <td style={{ padding: '8px 6px', fontFamily: 'JetBrains Mono, monospace' }}>{row.qtyIn}</td>
                            <td style={{ padding: '8px 6px', color: '#8a847c' }}>{row.commentIn}</td>
                            <td style={{ padding: '8px 6px' }}>{row.toWho}</td>
                            <td style={{ padding: '8px 6px', fontFamily: 'JetBrains Mono, monospace' }}>{row.qtyOut}</td>
                            <td style={{ padding: '8px 6px', color: '#8a847c' }}>{row.commentOut}</td>
                            <td style={{ padding: '8px 6px' }}>{row.invoiceNum}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {r.comment && <div style={{ fontSize: 12, color: '#6b655b', marginTop: 10, padding: '8px 10px', background: '#faf8f6', borderRadius: 7 }}>{r.comment}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                      <Btn size="sm" onClick={() => onReportAction(r.id, 'processing')}>Провести в 1С</Btn>
                      <Btn size="sm" variant="primary" onClick={() => onReportAction(r.id, 'done')}>✓ Готово</Btn>
                      <Btn size="sm" onClick={() => onReportAction(r.id, 'archive')}>В архив</Btn>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Archive ──────────────────────────────────────────────────────────────────

function Archive({ orders, tab, setTab, onOpen, onAction, projects, specProjects }: {
  orders: Order[]
  tab: ArchiveTab
  setTab: (t: ArchiveTab) => void
  onOpen: (id: string) => void
  onAction: (id: string, a: string) => void
  projects: Project[]
  specProjects: SpecProject[]
}) {
  const [search, setSearch] = useState('')
  const archivedCards = orders.filter(o => o.screen === 'archive')
  const archivedProjects = projects.filter(p => p.status === 'archive')
  const archivedSpec = specProjects.filter(p => p.status === 'archive')

  const q = search.toLowerCase().trim()
  const filteredCards = archivedCards.filter(o => !q || o.id.toLowerCase().includes(q) || o.from.toLowerCase().includes(q) || o.positions.some(p => (p.name1c || p.oral).toLowerCase().includes(q)))
  const turnover = filteredCards.reduce((s, o) => s + cardSum(o), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1080, animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e6e2dc' }}>
        <TabBtn active={tab === 'cards'} onClick={() => setTab('cards')}>Карточки <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, marginLeft: 4 }}>{archivedCards.length}</span></TabBtn>
        <TabBtn active={tab === 'projects'} onClick={() => setTab('projects')}>Проекты <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, marginLeft: 4 }}>{archivedProjects.length}</span></TabBtn>
        <TabBtn active={tab === 'specprojects'} onClick={() => setTab('specprojects')}>СпецПроекты <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, marginLeft: 4 }}>{archivedSpec.length}</span></TabBtn>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск по номеру, заказчику, номенклатуре…" style={{ flex: 1, padding: '10px 14px', border: '1px solid #ddd8d0', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }} />
        {tab === 'cards' && (
          <div style={{ fontSize: 12, color: '#6b655b', whiteSpace: 'nowrap' }}>
            Показано: <b>{filteredCards.length}</b> из <b>{archivedCards.length}</b> · Оборот: <b>{fmtMoney(turnover)}</b>
          </div>
        )}
      </div>

      {tab === 'cards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {filteredCards.length === 0 && <div style={{ color: '#a39c92', textAlign: 'center', padding: 30 }}>Нет карточек</div>}
          {filteredCards.map(card => (
            <div key={card.id} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 15, opacity: card.cold ? 0.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 13 }}>{card.id}</span>
                    <span style={statusStyle('Архив')}>Архив</span>
                    {card.posted1C && <span style={{ background: '#e8f5ee', color: '#2e8a5e', fontSize: 10.5, padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>✓ 1С</span>}
                    {card.cold && <span title="Холодный архив">❄️</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#6b655b' }}>{card.from} → {card.to} · доставлено {fmtDate(card.delivered)} · позиций {card.positions.length}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(cardSum(card))}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <Btn size="sm" onClick={() => onOpen(card.id)}>Открыть</Btn>
                <Btn size="sm" onClick={() => onAction(card.id, 'createDoc')}>↓ Счёт</Btn>
                <Btn size="sm" onClick={() => onAction(card.id, 'createDoc')}>↓ Счёт-фактура</Btn>
                <Btn size="sm" onClick={() => onAction(card.id, 'restore')}>↺ Вернуть</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'projects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {archivedProjects.filter(p => !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)).map(p => {
            const pOrders = orders.filter(o => o.projectId === p.id)
            const sum = pOrders.reduce((s, o) => s + cardSum(o), 0)
            const client = p.clientId ? 'Заказчик' : '—'
            return (
              <div key={p.id} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 15 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{p.id}</span>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span style={statusStyle('Архив')}>Архив</span>
                </div>
                <div style={{ fontSize: 12.5, color: '#6b655b' }}>{client} · {fmtDate(p.createdAt)} · {pOrders.length} карточек · {fmtMoney(sum)} · 100%</div>
                <div style={{ marginTop: 10 }}><Btn size="sm">Открыть</Btn></div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'specprojects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {archivedSpec.filter(p => !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)).map(sp => {
            const pOrders = orders.filter(o => o.specProjectId === sp.id)
            const sum = pOrders.reduce((s, o) => s + cardSum(o), 0)
            return (
              <div key={sp.id} style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 10, padding: 15 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{sp.id}</span>
                  <span style={{ fontWeight: 600 }}>{sp.name}</span>
                  <span style={statusStyle('Архив')}>Архив</span>
                </div>
                <div style={{ fontSize: 12.5, color: '#6b655b' }}>Смета: {sp.items.length} позиций · собрано 100%</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', marginTop: 6 }}>{fmtMoney(sum)}</div>
                <div style={{ marginTop: 10 }}><Btn size="sm">Открыть</Btn></div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function SettingsScreen({ data, orders, onRefresh, onToast }: {
  data: SettingsData
  orders: Order[]
  onRefresh: () => void
  onToast: (msg: string) => void
}) {
  const [tab, setTab] = useState<SettingsTab>('users')
  const [userModal, setUserModal] = useState<UserFormData | null | 'new'>(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showSpecModal, setShowSpecModal] = useState(false)
  const [showNomModal, setShowNomModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [projForm, setProjForm] = useState({ name: '', clientId: '', description: '' })
  const [specForm, setSpecForm] = useState({ name: '', clientId: '', description: '', items: [{ name: '', qty: 1, unit: 'шт', nomenclatureId: '' }] })
  const [nomForm, setNomForm] = useState({ name: '', unit: 'шт', cat: '' })
  const [paymentForm, setPaymentForm] = useState({ name: '' })

  const clients = data.users.filter(u => isClientRole(u.role))
  const tabs: [SettingsTab, string, number][] = [
    ['users', 'Пользователи системы', data.users.length],
    ['projects', 'Проекты', data.projects.length],
    ['specprojects', 'СпецПроекты', data.specProjects.length],
    ['nomenclature', 'Номенклатура', data.nomenclature.length],
    ['payment', 'Оплата', data.paymentStatuses.length],
  ]

  async function handleUserSave(form: UserFormData, isNew: boolean) {
    const payload = {
      name: form.name, role: form.role, companyId: form.companyId || undefined,
      email: form.email || undefined, phone: form.phone || undefined,
      password: form.password || undefined, slug: form.slug || undefined, active: form.active,
    }
    if (isNew) {
      const result = await createUser(payload)
      onRefresh()
      return { password: form.password, user: result as User }
    }
    await updateUser(form.id!, payload)
    onRefresh()
    return { user: { ...form, id: form.id!, createdAt: new Date().toISOString() } as User }
  }

  async function saveProject() {
    if (!projForm.name) return
    await createProject(projForm)
    setShowProjectModal(false)
    setProjForm({ name: '', clientId: '', description: '' })
    onRefresh()
    onToast('✓ Проект создан')
  }

  async function saveSpecProject() {
    if (!specForm.name) return
    await createSpecProject({
      name: specForm.name,
      clientId: specForm.clientId || undefined,
      description: specForm.description,
      items: specForm.items.filter(i => i.name).map(i => ({ name: i.name, qty: i.qty, unit: i.unit, nomenclatureId: i.nomenclatureId || undefined })),
    })
    setShowSpecModal(false)
    setSpecForm({ name: '', clientId: '', description: '', items: [{ name: '', qty: 1, unit: 'шт', nomenclatureId: '' }] })
    onRefresh()
    onToast('✓ СпецПроект создан')
  }

  async function saveNomenclature() {
    if (!nomForm.name.trim()) return
    await createNomenclature(nomForm)
    setShowNomModal(false)
    setNomForm({ name: '', unit: 'шт', cat: '' })
    onRefresh()
    onToast('✓ Номенклатура добавлена')
  }

  async function savePaymentStatus() {
    if (!paymentForm.name.trim()) return
    await createPaymentStatus(paymentForm)
    setShowPaymentModal(false)
    setPaymentForm({ name: '' })
    onRefresh()
    onToast('✓ Статус оплаты добавлен')
  }

  function openEditUser(u: User) {
    setUserModal({
      id: u.id, name: u.name, role: u.role, companyId: u.companyId || '',
      email: u.email || '', phone: u.phone || '', password: '', slug: u.slug || '', active: u.active,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 15, maxWidth: 1100, animation: 'ukfade .25s' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e6e2dc', flexWrap: 'wrap' }}>
        {tabs.map(([id, label, count]) => (
          <TabBtn key={id} active={tab === id} onClick={() => setTab(id)}>
            {label} <span style={{ opacity: 0.55, fontFamily: 'JetBrains Mono, monospace' }}>{count}</span>
          </TabBtn>
        ))}
      </div>

      {tab === 'users' && (
        <>
          <div style={{ fontSize: 12.5, color: '#8a847c' }}>
            Клиенты — пользователи с ролью «Клиент» или «Поставщик/заказчик». Ссылки: /client/[slug] и /rsp/[slug]
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn variant="primary" onClick={() => setUserModal('new')}>+ Добавить пользователя</Btn>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 11, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#faf8f6', borderBottom: '1px solid #eee8e1' }}>
                  {['Имя', 'Роль', 'Компания', 'Доступ/ссылка', 'Статус', '', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10.5, color: '#a39c92', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.users.map(u => {
                  const rc = ROLE_COLORS[u.role] || ROLE_COLORS.client
                  const company = u.companyId ? data.users.find(x => x.id === u.companyId)?.name : '—'
                  const link = userLink(u)
                  const canLink = link && (u.role === 'logist' || isClientRole(u.role))
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f4f1ec', opacity: u.active ? 1 : 0.5 }}>
                      <td style={{ padding: '12px 14px', fontWeight: 500 }}>{u.name}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: rc.bg, color: rc.color, fontSize: 10.5, padding: '2px 9px', borderRadius: 20, fontWeight: 600 }}>{roleLabel(u.role)}</span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#6b655b' }}>{company}</td>
                      <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6b655b' }}>
                        {u.role === 'logist' && u.slug ? `/rsp/${u.slug}` : isClientRole(u.role) && u.slug ? `/client/${u.slug}` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: u.active ? '#2e8a5e' : '#b8b1a6', fontWeight: 500 }}>{u.active ? 'Активен' : 'Неактивен'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {canLink && <button onClick={() => { copyText(link!); onToast('Ссылка скопирована') }} style={{ border: '1px solid #e0dcd5', background: '#fff', padding: '6px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>📎</button>}
                      </td>
                      <td style={{ padding: '12px 14px' }}><Btn size="sm" onClick={() => openEditUser(u)}>Изменить</Btn></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'projects' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn variant="primary" onClick={() => setShowProjectModal(true)}>+ Создать проект</Btn></div>
          <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 11, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#faf8f6', borderBottom: '1px solid #eee8e1' }}>
                  {['ID', 'Название', 'Тип', 'Заказчик', 'Карточек', 'Статус'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10.5, color: '#a39c92', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.projects.map(p => {
                  const cnt = orders.filter(o => o.projectId === p.id).length
                  const client = clients.find(c => c.id === p.clientId)?.name || '—'
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f4f1ec' }}>
                      <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace' }}>{p.id}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 500 }}>{p.name}</td>
                      <td style={{ padding: '12px 14px', color: '#6b655b' }}>Проект</td>
                      <td style={{ padding: '12px 14px', color: '#6b655b' }}>{client}</td>
                      <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace' }}>{cnt}</td>
                      <td style={{ padding: '12px 14px' }}><span style={statusStyle(p.status === 'archive' ? 'Архив' : 'В работе')}>{p.status === 'archive' ? 'Архив' : 'Активен'}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'specprojects' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn variant="primary" onClick={() => setShowSpecModal(true)}>+ Создать СпецПроект</Btn></div>
          <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 11, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#faf8f6', borderBottom: '1px solid #eee8e1' }}>
                  {['ID', 'Название', 'Заказчик', 'Карточек', 'Прогресс', 'Статус'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10.5, color: '#a39c92', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.specProjects.map(sp => {
                  const cnt = orders.filter(o => o.specProjectId === sp.id).length
                  const client = clients.find(c => c.id === sp.clientId)?.name || '—'
                  const linked = orders.filter(o => o.specProjectId === sp.id)
                  const pct = sp.items.length ? Math.round(sp.items.reduce((s, it) => {
                    let got = 0
                    linked.forEach(o => o.positions.forEach(p => { if ((p.name1c || p.oral) === it.name) got += p.qty }))
                    return s + (it.qty > 0 ? Math.min(100, (got / it.qty) * 100) : 0)
                  }, 0) / sp.items.length) : 0
                  return (
                    <tr key={sp.id} style={{ borderBottom: '1px solid #f4f1ec' }}>
                      <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace' }}>{sp.id}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 500 }}>{sp.name}</td>
                      <td style={{ padding: '12px 14px', color: '#6b655b' }}>{client}</td>
                      <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace' }}>{cnt}</td>
                      <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace', color: '#c0532a' }}>{pct}%</td>
                      <td style={{ padding: '12px 14px' }}><span style={statusStyle(sp.status === 'archive' ? 'Архив' : 'В работе')}>{sp.status === 'archive' ? 'Архив' : 'Активен'}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'nomenclature' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn variant="primary" onClick={() => setShowNomModal(true)}>+ Добавить номенклатуру</Btn>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 11, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#faf8f6', borderBottom: '1px solid #eee8e1' }}>
                  {['Наименование 1С', 'Ед.', 'Категория'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10.5, color: '#a39c92', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.nomenclature.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#a39c92' }}>Номенклатура пуста — добавьте первую позицию</td></tr>
                )}
                {data.nomenclature.map(n => (
                  <tr key={n.id} style={{ borderBottom: '1px solid #f4f1ec' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 500 }}>{n.name}</td>
                    <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace', color: '#6b655b' }}>{n.unit}</td>
                    <td style={{ padding: '12px 14px', color: '#8a847c' }}>{n.cat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'payment' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn variant="primary" onClick={() => setShowPaymentModal(true)}>+ Добавить статус</Btn>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e6e2dc', borderRadius: 11, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#faf8f6', borderBottom: '1px solid #eee8e1' }}>
                  {['Статус', 'Активен'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10.5, color: '#a39c92', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.paymentStatuses.map(ps => (
                  <tr key={ps.id} style={{ borderBottom: '1px solid #f4f1ec' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 500 }}>{ps.name}</td>
                    <td style={{ padding: '12px 14px', color: ps.active ? '#2e8a5e' : '#b8b1a6' }}>{ps.active ? 'Да' : 'Нет'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {userModal !== null && (
        <UserModal
          user={userModal === 'new' ? null : userModal}
          allUsers={data.users}
          onClose={() => setUserModal(null)}
          onSave={handleUserSave}
          onToast={onToast}
        />
      )}

      {showProjectModal && (
        <div onClick={() => setShowProjectModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(33,31,28,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 420, padding: 22, animation: 'ukpop .18s' }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Создать проект</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input placeholder="Название *" value={projForm.name} onChange={e => setProjForm(f => ({ ...f, name: e.target.value }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }} />
              <select value={projForm.clientId} onChange={e => setProjForm(f => ({ ...f, clientId: e.target.value }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }}>
                <option value="">Заказчик</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <textarea placeholder="Описание" value={projForm.description} onChange={e => setProjForm(f => ({ ...f, description: e.target.value }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', minHeight: 70 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <Btn onClick={() => setShowProjectModal(false)}>Отмена</Btn>
              <Btn variant="primary" onClick={saveProject}>Сохранить →</Btn>
            </div>
          </div>
        </div>
      )}

      {showNomModal && (
        <div onClick={() => setShowNomModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(33,31,28,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 420, padding: 22, animation: 'ukpop .18s' }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Добавить номенклатуру</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input placeholder="Наименование 1С *" value={nomForm.name} onChange={e => setNomForm(f => ({ ...f, name: e.target.value }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }} />
              <input placeholder="Ед. измерения" value={nomForm.unit} onChange={e => setNomForm(f => ({ ...f, unit: e.target.value }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }} />
              <input placeholder="Категория" value={nomForm.cat} onChange={e => setNomForm(f => ({ ...f, cat: e.target.value }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <Btn onClick={() => setShowNomModal(false)}>Отмена</Btn>
              <Btn variant="primary" onClick={saveNomenclature}>Сохранить →</Btn>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div onClick={() => setShowPaymentModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(33,31,28,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 380, padding: 22, animation: 'ukpop .18s' }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Добавить статус оплаты</div>
            <input placeholder="Название статуса *" value={paymentForm.name} onChange={e => setPaymentForm({ name: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <Btn onClick={() => setShowPaymentModal(false)}>Отмена</Btn>
              <Btn variant="primary" onClick={savePaymentStatus}>Сохранить →</Btn>
            </div>
          </div>
        </div>
      )}

      {showSpecModal && (
        <div onClick={() => setShowSpecModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(33,31,28,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 520, maxHeight: '90vh', overflowY: 'auto', padding: 22, animation: 'ukpop .18s' }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Создать СпецПроект</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              <input placeholder="Название *" value={specForm.name} onChange={e => setSpecForm(f => ({ ...f, name: e.target.value }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }} />
              <select value={specForm.clientId} onChange={e => setSpecForm(f => ({ ...f, clientId: e.target.value }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }}>
                <option value="">Заказчик</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <textarea placeholder="Описание" value={specForm.description} onChange={e => setSpecForm(f => ({ ...f, description: e.target.value }))} style={{ padding: 8, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', minHeight: 60 }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b655b', marginBottom: 8 }}>СМЕТА</div>
            {specForm.items.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 60px 32px', gap: 8, marginBottom: 8 }}>
                <select value={it.nomenclatureId} onChange={e => {
                  const nom = data.nomenclature.find(n => n.id === e.target.value)
                  setSpecForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, nomenclatureId: e.target.value, name: nom?.name || x.name, unit: nom?.unit || x.unit } : x) }))
                }} style={{ padding: 7, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit', fontSize: 12 }}>
                  <option value="">Наименование</option>
                  {data.nomenclature.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
                <input type="number" value={it.qty} onChange={e => setSpecForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, qty: +e.target.value } : x) }))} style={{ padding: 7, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }} />
                <input value={it.unit} onChange={e => setSpecForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? { ...x, unit: e.target.value } : x) }))} style={{ padding: 7, border: '1px solid #ddd8d0', borderRadius: 7, fontFamily: 'inherit' }} />
                <button onClick={() => setSpecForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))} style={{ border: '1px solid #e6dcd6', background: '#fff', borderRadius: 7, cursor: 'pointer' }}>🗑</button>
              </div>
            ))}
            <button onClick={() => setSpecForm(f => ({ ...f, items: [...f.items, { name: '', qty: 1, unit: 'шт', nomenclatureId: '' }] }))} style={{ background: 'none', border: '1px dashed #d8d3cc', padding: '6px 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, marginBottom: 14 }}>+ Добавить позицию</button>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setShowSpecModal(false)}>Отмена</Btn>
              <Btn variant="primary" onClick={saveSpecProject}>Сохранить СпецПроект →</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main AdminApp ────────────────────────────────────────────────────────────

export default function AdminApp({ user }: { user: SessionUser }) {
  const [screen, setScreen] = useState<AdminScreen>('dashboard')
  const [incTab, setIncTab] = useState<IncTab>('new')
  const [outTab, setOutTab] = useState<OutgoingTab>('inwork')
  const [filterSelections, setFilterSelections] = useState<AdminFilterSelections>(EMPTY_FILTER_SELECTIONS)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('inwork')
  const [archiveTab, setArchiveTab] = useState<ArchiveTab>('cards')
  const [bookkeepingTab, setBookkeepingTab] = useState<BookkeepingTab>('cards')
  const [orders, setOrders] = useState<Order[]>([])
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [settingsData, setSettingsData] = useState<SettingsData | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [reports, setReports] = useState<DailyReport[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }, [])

  const loadOrders = useCallback(async () => {
    try { setOrders(await fetchAllOrders()) } catch { showToast('Ошибка загрузки заказов') }
  }, [showToast])

  const loadDash = useCallback(async () => {
    try { setDashData(await fetchDashboard()) } catch { /* ignore */ }
  }, [])

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true)
    setSettingsError(null)
    try {
      setSettingsData(await fetchSettings())
    } catch {
      setSettingsError('Не удалось загрузить справочники. Обновите базу: npm run db:push && npm run db:seed')
      setSettingsData({ users: [], projects: [], specProjects: [], suppliers: [], nomenclature: [], paymentStatuses: [] })
      showToast('Ошибка загрузки настроек')
    } finally {
      setSettingsLoading(false)
    }
  }, [showToast])

  const loadReports = useCallback(async () => {
    try { setReports(await fetchDailyReports()) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    Promise.all([loadOrders(), loadDash(), loadSettings()]).finally(() => setLoading(false))
  }, [loadOrders, loadDash, loadSettings])

  useEffect(() => {
    if (screen === 'settings' && !settingsData) loadSettings()
    if (screen === 'dashboard') loadDash()
    if (screen === 'bookkeeping') loadReports()
    if (screen === 'reception' && !settingsData) loadSettings()
    if (screen === 'filter' && !settingsData) loadSettings()
    if (screen === 'archive' && !settingsData) loadSettings()
  }, [screen, settingsData, loadSettings, loadDash, loadReports])

  const handleAction = useCallback(async (id: string, action: string, payload?: Record<string, unknown>) => {
    try {
      const updated = await orderAction(id, action, payload)
      setOrders(prev => prev.map(o => o.id === id ? updated : o))
      const msgs: Record<string, string> = {
        accept: `✓ ${id} → Приёмка`, take: `✓ ${id} → Стол приёмки`, process: `✓ ${id} → Исходящие`,
        markAll: `✓ ${id} — все доставлены`, sendAcc: `✓ ${id} → К учёту`, postAcc: `✓ ${id} → Бухгалтерия`,
        returnOut: `${id} → Входящие`, returnToAcc: `${id} → К учёту`, cancel: `${id} отменён`,
        restore: `${id} восстановлен`, confirmChg: '✓ Изменение принято', postpone: `${id} — отложено`,
        createDoc: '✓ Документ создан', post1C: `✓ ${id} проведён в 1С`, sendArchive: `✓ ${id} → Архив`,
        updatePos: '✓ Позиция обновлена',
      }
      showToast(msgs[action] || `✓ ${action}`)
      loadDash()
      if (action === 'sendArchive' || action === 'restore' || action === 'postAcc') loadOrders()
    } catch (e) { showToast(`Ошибка: ${(e as Error).message}`) }
  }, [showToast, loadDash, loadOrders])

  const handlePostAll = useCallback(async () => {
    try {
      const { count } = await postAll()
      await loadOrders()
      await loadDash()
      showToast(`✓ Проведено: ${count}`)
    } catch { showToast('Ошибка') }
  }, [loadOrders, loadDash, showToast])

  const handleReportAction = useCallback(async (id: string, status: string) => {
    try {
      await updateDailyReport(id, status)
      await loadReports()
      showToast('✓ Отчёт обновлён')
    } catch { showToast('Ошибка') }
  }, [loadReports, showToast])

  const inc = orders.filter(o => o.screen === 'incoming')
  const newCards = inc.filter(o => !o.isDraft && !o.isCancelled && !o.toacc)
  const changed = orders.filter(o => o.isChanged && !o.isCancelled && !o.isDraft)
  const reception = orders.filter(o => o.screen === 'reception')
  const outgoing = orders.filter(o => o.screen === 'outgoing' && o.status === 'В работе')
  const accounting = orders.filter(o => o.screen === 'accounting')
  const bookkeeping = orders.filter(o => o.screen === 'bookkeeping')
  const toaccCount = inc.filter(o => o.toacc).length + accounting.length

  const navItems = [
    { id: 'dashboard' as AdminScreen, label: 'Дашборд', badge: 0 },
    { id: 'reception' as AdminScreen, label: 'Приёмка', badge: reception.length },
    { id: 'incoming' as AdminScreen, label: 'Входящие', badge: newCards.length + changed.length },
    { id: 'outgoing' as AdminScreen, label: 'Исходящие', badge: outgoing.length },
    { id: 'filter' as AdminScreen, label: 'Фильтр', badge: 0 },
    { id: 'accounting' as AdminScreen, label: 'К Учёту', badge: accounting.length },
    { id: 'warehouse' as AdminScreen, label: 'Склад', badge: 0 },
    { id: 'bookkeeping' as AdminScreen, label: 'Бухгалтерия', badge: bookkeeping.length },
    { id: 'archive' as AdminScreen, label: 'Архив', badge: 0 },
    { id: 'settings' as AdminScreen, label: 'Настройки', badge: 0 },
  ]

  const titles: Record<AdminScreen, [string, string]> = {
    dashboard: ['Дашборд', 'Сводка по системе U-Kan'],
    reception: ['Приёмка', 'Обработка и подготовка заказов'],
    incoming: ['Входящие', 'Приём и сортировка заявок'],
    outgoing: ['Исходящие', 'Активное исполнение'],
    filter: ['Фильтр', 'Канбан по заказчикам и поставщикам'],
    accounting: ['К Учёту', 'Проверка перед бухгалтерией'],
    warehouse: ['Склад', 'Центр Склад — остатки и движение'],
    bookkeeping: ['Бухгалтерия', 'Документы и ежедневные отчёты'],
    archive: ['Архив', 'Завершённые заказы и проекты'],
    settings: ['Настройки', 'Справочники, пользователи и ссылки доступа'],
  }

  const [title, subtitle] = titles[screen]
  const detailOrder = orders.find(o => o.id === detailId) || null

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', fontSize: 13, fontFamily: "'Golos Text', system-ui, sans-serif" }}>
      <aside style={{ width: 230, flexShrink: 0, background: '#211f1c', color: '#cfc9c0', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '20px 22px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #322f2b' }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: '#d4613a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 15 }}>U</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: -0.2 }}>U-Kan</div>
            <div style={{ fontSize: 10.5, color: '#8c857a', letterSpacing: 0.3 }}>ЛОГИСТИКА · АДМИН</div>
          </div>
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => {
            const active = item.id === screen
            return (
              <button key={item.id} onClick={() => setScreen(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 600 : 500, textAlign: 'left', background: active ? '#d4613a' : 'transparent', color: active ? '#fff' : '#cfc9c0' }}>
                <span style={{ width: 3, height: 15, borderRadius: 2, background: active ? 'rgba(255,255,255,.55)' : 'transparent', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', padding: '1px 7px', borderRadius: 20, background: active ? 'rgba(255,255,255,.22)' : '#3a3631', color: active ? '#fff' : '#cfc9c0' }}>{item.badge}</span>}
=======
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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
              </button>
            ))}
          </div>
<<<<<<< HEAD
          <div style={{ marginBottom: 6 }}>{user.name}</div>
          <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8c857a', fontFamily: 'inherit', fontSize: 11, padding: 0, textDecoration: 'underline' }}>Выйти</button>
          <div style={{ marginTop: 6 }}>Версия 1.0 · 21.06.2026</div>
=======
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9d9690', fontSize: 13, padding: '40px 20px' }}>Ничего не найдено</div>
          ) : filtered.map(o => (
            <Card key={o.id} order={o} onClick={() => onSelect(o)} selected={o.id === selectedId} />
          ))}
        </div>
      </div>

<<<<<<< HEAD
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, background: '#f1efec' }}>
        <header style={{ flexShrink: 0, height: 60, background: '#fff', borderBottom: '1px solid #e6e2dc', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>{title}</div>
            <div style={{ fontSize: 11.5, color: '#8a847c' }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Активных', value: orders.filter(o => !o.isDraft && !o.isCancelled && o.screen !== 'archive').length, color: '#4a5aaa', bg: '#eef2ff' },
              { label: 'В работе', value: outgoing.length, color: '#c0532a', bg: '#fff0ea' },
              { label: 'Просрочено', value: orders.filter(o => isOverdue(o)).length, color: '#b03020', bg: '#faeaea' },
              { label: 'К учёту', value: toaccCount, color: '#2e8a5e', bg: '#e8f5ee' },
            ].map(p => (
              <div key={p.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 62, padding: '5px 12px', borderRadius: 9, background: p.bg, color: p.color }}>
                <span style={{ fontWeight: 700, fontSize: 15, fontFamily: 'JetBrains Mono, monospace' }}>{p.value}</span>
                <span style={{ fontSize: 10.5, opacity: 0.85 }}>{p.label}</span>
              </div>
            ))}
          </div>
          <button
            onClick={async () => {
              setLoading(true)
              await Promise.all([loadOrders(), loadDash()])
              if (screen === 'bookkeeping') await loadReports()
              setLoading(false)
              showToast('Данные обновлены')
            }}
            title="Обновить"
            style={{ width: 36, height: 36, flexShrink: 0, border: '1px solid #e0dcd5', background: '#fff', borderRadius: 8, cursor: 'pointer', color: '#6b655b', fontSize: 15 }}
          >
            {loading ? '…' : '⟳'}
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px 60px' }}>
          {screen === 'dashboard' && <Dashboard data={dashData} onGo={setScreen} />}
          {screen === 'reception' && (
            <Reception
              orders={orders}
              onAction={handleAction}
              onOpen={setDetailId}
              settings={settingsData}
              onCreated={loadOrders}
            />
          )}
          {screen === 'incoming' && <Incoming orders={orders} tab={incTab} setTab={setIncTab} onAction={handleAction} onOpen={setDetailId} />}
          {screen === 'outgoing' && <Outgoing orders={orders} tab={outTab} setTab={setOutTab} onAction={handleAction} onOpen={setDetailId} />}
          {screen === 'filter' && (
            <FilterKanban
              orders={orders}
              selections={filterSelections}
              setSelections={setFilterSelections}
              statusFilter={filterStatus}
              setStatusFilter={setFilterStatus}
              onOpen={setDetailId}
              settings={settingsData}
            />
          )}
          {screen === 'accounting' && <Accounting orders={orders} onAction={handleAction} onOpen={setDetailId} onPostAll={handlePostAll} />}
          {screen === 'warehouse' && <Warehouse />}
          {screen === 'bookkeeping' && (
            <BookkeepingScreen
              orders={orders}
              tab={bookkeepingTab}
              setTab={setBookkeepingTab}
              onAction={handleAction}
              onOpen={setDetailId}
              reports={reports}
              onReportAction={handleReportAction}
            />
          )}
          {screen === 'archive' && settingsData && (
            <Archive
              orders={orders}
              tab={archiveTab}
              setTab={setArchiveTab}
              onOpen={setDetailId}
              onAction={handleAction}
              projects={settingsData.projects}
              specProjects={settingsData.specProjects}
            />
          )}
          {screen === 'settings' && (
            <>
              {settingsLoading && (
                <div style={{ padding: '8px 0 12px', fontSize: 13, color: '#8a847c' }}>Загрузка справочников…</div>
              )}
              {settingsError && (
                <div style={{ background: '#fff8e1', border: '1px solid #e6d9a8', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#6b655b' }}>
                  ⚠ {settingsError}
                  <button onClick={loadSettings} style={{ marginLeft: 12, border: '1px solid #d8d3cc', background: '#fff', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Повторить</button>
                </div>
              )}
              <SettingsScreen data={settingsData ?? EMPTY_SETTINGS} orders={orders} onRefresh={loadSettings} onToast={showToast} />
=======
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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
            </>
          )}
        </div>
      </div>

<<<<<<< HEAD
      {detailId && detailOrder && <CardDetailModal order={detailOrder} onClose={() => setDetailId(null)} />}
      {toast && <Toast msg={toast} />}
=======
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
    </div>
  )
}