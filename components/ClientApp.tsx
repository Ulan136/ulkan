'use client'
<<<<<<< HEAD

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchClientOrders,
  fetchDirectory,
  createClientOrder,
  orderAction,
  fetchNotifications,
  fetchHistory,
  markNotificationRead,
  logout,
} from '@/lib/api'
import { COLORS } from '@/lib/colors'
import {
  cardProgress,
  barColor,
  statusStyle,
  fmtDate,
  fmtDateTime,
} from '@/lib/display'
import type { Order, Notification, SessionUser } from '@/lib/types'

// ─── Helpers ───────────────────────────────────────────────────

function copyText(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {})
  }
}

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^8/, '7').slice(0, 11)
  if (!digits) return ''
  let result = '+7'
  const rest = digits.startsWith('7') ? digits.slice(1) : digits
  if (rest.length > 0) result += ' ' + rest.slice(0, 3)
  if (rest.length > 3) result += ' ' + rest.slice(3, 6)
  if (rest.length > 6) result += ' ' + rest.slice(6, 8)
  if (rest.length > 8) result += ' ' + rest.slice(8, 10)
  return result
}

function phoneDigits(formatted: string): string {
  const d = formatted.replace(/\D/g, '')
  return d.startsWith('7') ? '+' + d : '+7' + d
}

function isInWork(o: Order): boolean {
  return !o.isDraft && !o.isCancelled && o.status !== 'Доставлено' && o.screen !== 'archive'
}

function isDelivered(o: Order): boolean {
  return o.status === 'Доставлено' || o.toacc || o.screen === 'archive'
}

function previewText(text: string, max = 120): string {
  const t = text.trim()
  if (t.length <= max) return t || '—'
  return t.slice(0, max) + '…'
}

function trackingUrl(order: Order): string {
  if (order.trackingLink) return order.trackingLink
  if (typeof window !== 'undefined') return `${window.location.origin}/track?id=${order.id}`
  return `/track?id=${order.id}`
}

function cabinetUrl(slug?: string): string {
  if (!slug) return '/'
  if (typeof window !== 'undefined') return `${window.location.origin}/client/${slug}`
  return `/client/${slug}`
}

interface HistoryItem {
  id: string
  action: string
  detail: string
  userName: string
  createdAt: string
}

type ClientFilter = 'all' | 'inwork' | 'delivered' | 'changed'

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
    transition: 'opacity .15s',
    fontSize: size === 'sm' ? 12 : 13.5,
    padding: size === 'sm' ? '6px 14px' : '10px 18px',
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

function ProgressBar({ pct, height = 5 }: { pct: number; height?: number }) {
  return (
    <div style={{ background: COLORS.borderLight, borderRadius: height, height, overflow: 'hidden', width: '100%' }}>
      <div
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          height: '100%',
          background: barColor(pct),
          borderRadius: height,
          transition: 'width .3s ease',
        }}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return <span style={statusStyle(status)}>{status}</span>
}

function Toast({ message }: { message: string }) {
  return (
    <div
      className="anim-fade"
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        background: COLORS.dark,
        color: COLORS.white,
        padding: '12px 22px',
        borderRadius: 12,
        fontSize: 13.5,
        fontWeight: 500,
        zIndex: 9999,
        boxShadow: '0 8px 32px rgba(33,31,28,.25)',
        animation: 'uktoast .22s ease both',
      }}
    >
      {message}
    </div>
  )
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(33,31,28,.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div className="anim-pop" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520 }}>
        {children}
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: COLORS.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>
      {children}
    </label>
  )
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

// ─── Modals ────────────────────────────────────────────────────

function ToField({
  show,
  value,
  onChange,
  logists,
}: {
  show: boolean
  value: string
  onChange: (v: string) => void
  logists: { name: string }[]
}) {
  if (!show) return null
  return (
    <div>
      <FieldLabel>К кому</FieldLabel>
      <select style={inputStyle} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Выберите логиста…</option>
        {logists.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
      </select>
    </div>
  )
}

function CreateOrderModal({
  user,
  logists,
  showToField,
  onClose,
  onSuccess,
  onDraftSaved,
}: {
  user: SessionUser
  logists: { name: string }[]
  showToField: boolean
  onClose: () => void
  onSuccess: (order: Order, trackingUrl: string) => void
  onDraftSaved: () => void
}) {
  const [to, setTo] = useState('')
  const [deadline, setDeadline] = useState('')
  const [text, setText] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(isDraft: boolean) {
    if (!text.trim() && !isDraft) {
      setError('Укажите текст заявки')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await createClientOrder({ to, deadline, text, comment, isDraft })
      if (isDraft) {
        onDraftSaved()
        onClose()
      } else {
        onSuccess(res.order, res.trackingUrl)
      }
    } catch {
      setError('Не удалось отправить заявку')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: COLORS.white, borderRadius: 16, padding: '24px 26px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700 }}>Новый заказ</h2>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <FieldLabel>От кого</FieldLabel>
            <input style={{ ...inputStyle, background: COLORS.bgCard, color: COLORS.textMuted }} value={user.name} disabled />
          </div>
          <ToField show={showToField} value={to} onChange={setTo} logists={logists} />
          <div>
            <FieldLabel>Желаемая дата</FieldLabel>
            <input type="date" style={inputStyle} value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Текст заявки *</FieldLabel>
            <textarea
              style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Перечислите позиции — каждая с новой строки"
            />
          </div>
          <div>
            <FieldLabel>Комментарий</FieldLabel>
            <textarea
              style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Дополнительная информация"
            />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#faeaea', color: '#b03020', borderRadius: 10, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <Btn variant="default" onClick={() => submit(true)} disabled={loading}>Сохранить черновик</Btn>
          <Btn variant="primary" onClick={() => submit(false)} disabled={loading} style={{ marginLeft: 'auto' }}>
            ОТПРАВИТЬ ЗАЯВКУ →
          </Btn>
        </div>
      </div>
    </ModalOverlay>
  )
}

function SuccessModal({
  order,
  trackingUrl: trackUrl,
  slug,
  onClose,
}: {
  order: Order
  trackingUrl: string
  slug?: string
  onClose: () => void
}) {
  const cabUrl = cabinetUrl(slug)
  const allText = `Заявка ${order.id} принята!\nКабинет: ${cabUrl}\nТрекинг: ${trackUrl}`

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: COLORS.white, borderRadius: 16, padding: '28px 26px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e8f5ee', color: '#2e8a5e', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          ✓
        </div>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>Заявка {order.id} принята!</h2>
        <p style={{ margin: '0 0 20px', color: COLORS.textMuted, fontSize: 13 }}>Менеджер обработает заявку в ближайшее время</p>

        <div style={{ textAlign: 'left', display: 'grid', gap: 10, marginBottom: 20 }}>
          <div>
            <FieldLabel>Ссылка кабинета</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, fontSize: 12 }} readOnly value={cabUrl} />
              <Btn size="sm" onClick={() => copyText(cabUrl)}>📋</Btn>
            </div>
          </div>
          <div>
            <FieldLabel>Ссылка трекинга</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, fontSize: 12 }} readOnly value={trackUrl} />
              <Btn size="sm" onClick={() => copyText(trackUrl)}>📋</Btn>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Btn
            variant="default"
            size="sm"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(allText)}`, '_blank')}
          >
            📱 WhatsApp
          </Btn>
          <Btn variant="default" size="sm" onClick={() => copyText(allText)}>📋 Скопировать всё</Btn>
          <Btn variant="ghost" size="sm" onClick={onClose}>Закрыть</Btn>
          <Btn variant="primary" size="sm" onClick={() => window.open(trackUrl, '_blank')}>🔗 Открыть трекинг →</Btn>
        </div>
      </div>
    </ModalOverlay>
  )
}

function OrderDetailModal({
  order,
  user,
  onClose,
  onChange,
  onEditDraft,
}: {
  order: Order
  user: SessionUser
  onClose: () => void
  onChange: () => void
  onEditDraft: () => void
}) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const pct = cardProgress(order)
  const canChange = order.screen === 'incoming' || order.screen === 'outgoing'

  useEffect(() => {
    fetchHistory(order.id).then(setHistory).catch(() => {})
  }, [order.id])

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: COLORS.white, borderRadius: 16, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, background: COLORS.white, zIndex: 1 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 14 }}>{order.id}</span>
          <StatusBadge status={order.status} />
          {order.isChanged && (
            <span style={{ fontSize: 10.5, padding: '1px 9px', borderRadius: 20, fontWeight: 600, background: '#fdf8e1', color: '#8a6f00' }}>изменено</span>
          )}
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: COLORS.textMuted }}>✕</button>
        </div>

        <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            {order.from} → {order.to || '—'}
          </div>
          <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginBottom: 14 }}>{fmtDate(order.createdAt)}</div>

          {!order.isDraft && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>
                <span>Прогресс</span>
                <span style={{ fontWeight: 600, color: COLORS.text }}>{pct}%</span>
              </div>
              <ProgressBar pct={pct} height={6} />
            </div>
          )}

          <div style={{ background: COLORS.bgCard, borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
            <FieldLabel>Текст заявки</FieldLabel>
            <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{order.comment || '—'}</div>
          </div>

          {order.phone && (
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 12 }}>
              Телефон: {order.phone}
            </div>
          )}

          {order.deadline && (
            <div style={{ fontSize: 13, marginBottom: 14 }}>
              <span style={{ color: COLORS.textMuted }}>Желаемая дата: </span>
              <span style={{ fontWeight: 600 }}>{fmtDate(order.deadline)}</span>
            </div>
          )}

          {order.positions.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <FieldLabel>Позиции</FieldLabel>
              <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {order.positions.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '28px 1fr auto auto',
                      gap: 8,
                      padding: '10px 12px',
                      fontSize: 13,
                      borderBottom: i < order.positions.length - 1 ? `1px solid ${COLORS.borderLight}` : 'none',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ color: COLORS.textMuted, fontSize: 12 }}>{i + 1}</span>
                    <span>{p.name1c || p.oral}</span>
                    <StatusBadge status={p.status || 'В ожидании'} />
                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{p.qty} {p.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <FieldLabel>История</FieldLabel>
              <div style={{ display: 'grid', gap: 8 }}>
                {history.map(h => (
                  <div key={h.id} style={{ display: 'flex', gap: 10, fontSize: 12.5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.primary, marginTop: 6, flexShrink: 0 }} />
                    <div>
                      <div>{h.action}{h.detail ? ` — ${h.detail}` : ''}</div>
                      <div style={{ color: COLORS.textMuted, fontSize: 11 }}>{fmtDateTime(h.createdAt)} · {h.userName}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <FieldLabel>Трекинг</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, fontSize: 12 }} readOnly value={trackingUrl(order)} />
              <Btn size="sm" onClick={() => copyText(trackingUrl(order))}>📋</Btn>
              <Btn size="sm" variant="primary" onClick={() => window.open(trackingUrl(order), '_blank')}>Трекинг →</Btn>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 22px', borderTop: `1px solid ${COLORS.border}`, display: 'flex', gap: 10 }}>
          {order.isDraft ? (
            <Btn variant="primary" onClick={onEditDraft}>Редактировать черновик</Btn>
          ) : canChange ? (
            <Btn variant="primary" onClick={onChange}>✎ Изменить заявку</Btn>
          ) : null}
          <Btn variant="ghost" onClick={onClose} style={{ marginLeft: 'auto' }}>Закрыть</Btn>
        </div>
      </div>
    </ModalOverlay>
  )
}

function ChangeOrderModal({
  order,
  user,
  logists,
  showToField,
  onClose,
  onSaved,
}: {
  order: Order
  user: SessionUser
  logists: { name: string }[]
  showToField: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [to, setTo] = useState(order.to)
  const [deadline, setDeadline] = useState(order.deadline ? order.deadline.slice(0, 10) : '')
  const [text, setText] = useState(order.comment)
  const [changeText, setChangeText] = useState('')
  const [phone, setPhone] = useState(formatPhoneInput(user.phone || ''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!changeText.trim()) {
      setError('Укажите комментарий к изменению')
      return
    }
    setLoading(true)
    setError('')
    try {
      await orderAction(order.id, 'changeOrder', {
        to,
        deadline,
        comment: text,
        changeText,
        changePhone: phoneDigits(phone),
      })
      onSaved()
      onClose()
    } catch {
      setError('Не удалось сохранить изменение')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: COLORS.white, borderRadius: 16, padding: '24px 26px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700 }}>Изменить заявку {order.id}</h2>

        <div style={{ display: 'grid', gap: 14 }}>
          <ToField show={showToField} value={to} onChange={setTo} logists={logists} />
          <div>
            <FieldLabel>Дата</FieldLabel>
            <input type="date" style={inputStyle} value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Текст заявки</FieldLabel>
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Комментарий к изменению *</FieldLabel>
            <textarea
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
              value={changeText}
              onChange={e => setChangeText(e.target.value)}
              placeholder="Опишите, что нужно изменить"
            />
          </div>
          <div>
            <FieldLabel>Телефон для связи</FieldLabel>
            <input
              style={inputStyle}
              value={phone}
              onChange={e => setPhone(formatPhoneInput(e.target.value))}
              placeholder="+7 ___ ___ __ __"
            />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#faeaea', color: '#b03020', borderRadius: 10, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Btn variant="ghost" onClick={onClose}>Отмена</Btn>
          <Btn variant="primary" onClick={save} disabled={loading} style={{ marginLeft: 'auto' }}>
            СОХРАНИТЬ ИЗМЕНЕНИЕ →
          </Btn>
        </div>
      </div>
    </ModalOverlay>
  )
}

function DraftModal({
  order,
  logists,
  showToField,
  onClose,
  onSaved,
  onDeleted,
  onSent,
}: {
  order: Order
  logists: { name: string }[]
  showToField: boolean
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
  onSent: (order: Order, trackingUrl: string) => void
}) {
  const [to, setTo] = useState(order.to)
  const [deadline, setDeadline] = useState(order.deadline ? order.deadline.slice(0, 10) : '')
  const [text, setText] = useState(order.comment)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function saveDraft() {
    setLoading(true)
    setError('')
    try {
      await orderAction(order.id, 'updateDraft', { to, deadline, comment: text, note: comment })
      onSaved()
      onClose()
    } catch {
      setError('Не удалось сохранить черновик')
    } finally {
      setLoading(false)
    }
  }

  async function sendDraft() {
    if (!text.trim()) {
      setError('Укажите текст заявки')
      return
    }
    setLoading(true)
    setError('')
    try {
      await orderAction(order.id, 'updateDraft', { to, deadline, comment: text, note: comment })
      const updated = await orderAction(order.id, 'sendDraft')
      onSent(updated, trackingUrl(updated))
      onClose()
    } catch {
      setError('Не удалось отправить заявку')
    } finally {
      setLoading(false)
    }
  }

  async function deleteDraft() {
    if (!confirm('Удалить черновик?')) return
    setLoading(true)
    try {
      await orderAction(order.id, 'cancel', { reason: 'Черновик удалён клиентом' })
      onDeleted()
      onClose()
    } catch {
      setError('Не удалось удалить черновик')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: COLORS.white, borderRadius: 16, padding: '24px 26px', maxHeight: '90vh', overflowY: 'auto', border: `2px dashed ${COLORS.border}` }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Черновик {order.id}</h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: COLORS.textMuted }}>Заявка ещё не отправлена менеджеру</p>

        <div style={{ display: 'grid', gap: 14 }}>
          <ToField show={showToField} value={to} onChange={setTo} logists={logists} />
          <div>
            <FieldLabel>Дата</FieldLabel>
            <input type="date" style={inputStyle} value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Текст</FieldLabel>
            <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Комментарий</FieldLabel>
            <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={comment} onChange={e => setComment(e.target.value)} />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#faeaea', color: '#b03020', borderRadius: 10, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <Btn variant="danger" size="sm" onClick={deleteDraft} disabled={loading}>Удалить черновик</Btn>
          <Btn variant="default" onClick={saveDraft} disabled={loading}>Сохранить</Btn>
          <Btn variant="primary" onClick={sendDraft} disabled={loading} style={{ marginLeft: 'auto' }}>
            ОТПРАВИТЬ ЗАЯВКУ →
          </Btn>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─── Main Component ────────────────────────────────────────────

export default function ClientApp({ user }: { user: SessionUser }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<ClientFilter>('all')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [successData, setSuccessData] = useState<{ order: Order; trackingUrl: string } | null>(null)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [changeOrder, setChangeOrder] = useState<Order | null>(null)
  const [draftOrder, setDraftOrder] = useState<Order | null>(null)
  const [logists, setLogists] = useState<{ name: string }[]>([])
  const showToField = user.role !== 'client'

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2300)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, n] = await Promise.all([fetchClientOrders(), fetchNotifications()])
      setOrders(o)
      setNotifications(n.slice(0, 8))
    } catch {
      showToast('Ошибка загрузки данных')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetchDirectory()
      .then(d => setLogists(d.logists || []))
      .catch(() => {})
  }, [])

  const stats = useMemo(() => ({
    total: orders.filter(o => !o.isCancelled).length,
    inwork: orders.filter(isInWork).length,
    delivered: orders.filter(isDelivered).length,
    changed: orders.filter(o => o.isChanged).length,
    drafts: orders.filter(o => o.isDraft).length,
  }), [orders])

  const filtered = useMemo(() => {
    let list = orders.filter(o => !o.isCancelled)
    if (filter === 'inwork') list = list.filter(isInWork)
    else if (filter === 'delivered') list = list.filter(isDelivered)
    else if (filter === 'changed') list = list.filter(o => o.isChanged)
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [orders, filter])

  function openOrder(o: Order) {
    if (o.isDraft) setDraftOrder(o)
    else setDetailOrder(o)
  }

  const filterPills: { id: ClientFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Все', count: stats.total },
    { id: 'inwork', label: 'В работе', count: stats.inwork },
    { id: 'delivered', label: 'Доставлено', count: stats.delivered },
    { id: 'changed', label: 'Изменённые', count: stats.changed },
  ]

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      {/* Topbar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: COLORS.white,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: '14px 20px',
        }}
      >
        <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: COLORS.primary,
              color: COLORS.white,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            U
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>U-Kan · Личный кабинет</div>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.textMuted }}>{user.name}</div>
          <button onClick={() => logout()} style={{ border: '1px solid #e0dcd5', background: '#fff', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#6b655b' }}>Выйти</button>
        </div>
      </div>

      <div className="anim-fade" style={{ maxWidth: 880, margin: '0 auto', padding: '20px 20px 40px' }}>
        {/* Stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 22 }}>
          {[
            { label: 'Всего', value: stats.total, color: COLORS.text },
            { label: 'В работе', value: stats.inwork, color: COLORS.primary },
            { label: 'Доставлено', value: stats.delivered, color: '#2e8a5e' },
            { label: 'Изменено', value: stats.changed, color: '#8a6f00' },
            { label: 'Черновики', value: stats.drafts, color: COLORS.textMuted },
          ].map(tile => (
            <div
              key={tile.label}
              style={{
                background: COLORS.white,
                borderRadius: 12,
                padding: '14px 12px',
                border: `1px solid ${COLORS.border}`,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: tile.color, fontFamily: 'JetBrains Mono, monospace' }}>
                {tile.value}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4, fontWeight: 500 }}>{tile.label}</div>
            </div>
          ))}
        </div>

        {/* Welcome */}
        <div
          style={{
            background: COLORS.white,
            borderRadius: 14,
            padding: '22px 24px',
            border: `1px solid ${COLORS.border}`,
            marginBottom: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700 }}>Здравствуйте, {user.name}</h1>
            <p style={{ margin: 0, fontSize: 13.5, color: COLORS.textMuted, lineHeight: 1.5 }}>
              Здесь вы можете подать заявку, отслеживать заказы и получать уведомления о статусах
            </p>
          </div>
          <Btn variant="primary" onClick={() => setShowCreate(true)}>＋ Создать новый заказ</Btn>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {filterPills.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setFilter(p.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                border: filter === p.id ? 'none' : `1px solid ${COLORS.border}`,
                background: filter === p.id ? COLORS.primary : COLORS.white,
                color: filter === p.id ? COLORS.white : COLORS.text,
                fontWeight: 600,
                fontSize: 12.5,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {p.label} {p.count}
            </button>
          ))}
        </div>

        {/* Order list */}
        {loading ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 110, background: COLORS.borderLight, borderRadius: 12, animation: 'ukfade .5s ease infinite alternate' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: COLORS.textMuted, background: COLORS.white, borderRadius: 14, border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
            <div style={{ fontWeight: 600 }}>Заказов пока нет</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Создайте первую заявку кнопкой выше</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
            {filtered.map(o => {
              const pct = cardProgress(o)
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => openOrder(o)}
                  style={{
                    background: COLORS.white,
                    border: `1px solid ${o.isDraft ? COLORS.border : COLORS.border}`,
                    borderRadius: 14,
                    padding: '16px 18px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    width: '100%',
                    borderStyle: o.isDraft ? 'dashed' : 'solid',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 13 }}>{o.id}</span>
                    <StatusBadge status={o.isDraft ? 'Черновик' : o.status} />
                    {o.isChanged && (
                      <span style={{ fontSize: 10.5, padding: '1px 9px', borderRadius: 20, fontWeight: 600, background: '#fdf8e1', color: '#8a6f00' }}>изменено</span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: COLORS.textMuted }}>{fmtDate(o.createdAt)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 12 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>→ {o.to || 'Не указано'}</span>
                  </div>

                  <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 10, lineHeight: 1.45 }}>
                    {previewText(o.comment)}
                  </div>

                  {!o.isDraft && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: COLORS.textMuted, marginBottom: 5 }}>
                        <span>Прогресс</span>
                        <span style={{ fontWeight: 600, color: COLORS.text }}>{pct}%</span>
                      </div>
                      <ProgressBar pct={pct} />
                    </div>
                  )}

                  <span
                    style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.primary }}
                    onClick={e => { e.stopPropagation(); window.open(trackingUrl(o), '_blank') }}
                  >
                    Отслеживать →
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Notifications */}
        <div style={{ background: COLORS.white, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Последние уведомления</h3>
          {notifications.length === 0 ? (
            <div style={{ fontSize: 13, color: COLORS.textMuted }}>Уведомлений пока нет</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {notifications.map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.read) markNotificationRead(n.id)
                    if (n.cardId) {
                      const o = orders.find(x => x.id === n.cardId)
                      if (o) openOrder(o)
                    }
                  }}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    background: n.read ? 'transparent' : COLORS.bgCard,
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: n.read ? COLORS.border : COLORS.primary, marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, color: COLORS.text }}>{n.text}</div>
                    <div style={{ fontSize: 11.5, color: COLORS.textMuted, marginTop: 3 }}>{fmtDateTime(n.createdAt)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateOrderModal
          user={user}
          logists={logists}
          showToField={showToField}
          onClose={() => setShowCreate(false)}
          onSuccess={(order, trackUrl) => {
            setShowCreate(false)
            setSuccessData({ order, trackingUrl: trackUrl })
            load()
          }}
          onDraftSaved={() => { showToast('Черновик сохранён'); load() }}
        />
      )}

      {successData && (
        <SuccessModal
          order={successData.order}
          trackingUrl={successData.trackingUrl}
          slug={user.slug}
          onClose={() => setSuccessData(null)}
        />
      )}

      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          user={user}
          onClose={() => setDetailOrder(null)}
          onChange={() => { setChangeOrder(detailOrder); setDetailOrder(null) }}
          onEditDraft={() => { setDraftOrder(detailOrder); setDetailOrder(null) }}
        />
      )}

      {changeOrder && (
        <ChangeOrderModal
          order={changeOrder}
          user={user}
          logists={logists}
          showToField={showToField}
          onClose={() => setChangeOrder(null)}
          onSaved={() => { showToast('Изменение отправлено'); load() }}
        />
      )}

      {draftOrder && (
        <DraftModal
          order={draftOrder}
          logists={logists}
          showToField={showToField}
          onClose={() => setDraftOrder(null)}
          onSaved={() => { showToast('Черновик сохранён'); load() }}
          onDeleted={() => { showToast('Черновик удалён'); load() }}
          onSent={(order, trackUrl) => {
            setSuccessData({ order, trackingUrl: trackUrl })
            load()
          }}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  )
}
=======
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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
