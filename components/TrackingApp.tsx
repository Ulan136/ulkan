'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchTrack, submitTrackChange, submitExternalOrder, loginPhone } from '@/lib/api'
import { COLORS } from '@/lib/colors'
import { barColor, statusStyle, fmtDateTime } from '@/lib/display'

// ─── Types ─────────────────────────────────────────────────────

interface TrackPosition {
  name: string
  qty: number
  unit: string
  status: string
}

interface TrackHistory {
  action: string
  time: string
}

interface TrackData {
  id: string
  from: string
  to: string
  status: string
  stage: number
  progress: number
  createdAt: string
  delivered?: string
  positions: TrackPosition[]
  history: TrackHistory[]
  details: Array<{ k: string; v: string }>
}

interface SubmitResult {
  cardId: string
  trackingUrl: string
  clientUrl: string
}

type TrackView = 'track' | 'submit'

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

function stageIcon(stage: number, status: string): string {
  if (status === 'Доставлено' || stage >= 5) return '✅'
  if (stage >= 3) return '🏗'
  return '🚚'
}

const TIMELINE_STEPS = ['Заявка', 'Принят', 'В работе', 'Готово', 'Доставлено']

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

function ProgressBar({ pct, height = 6 }: { pct: number; height?: number }) {
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
      <div className="anim-pop" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420 }}>
        {children}
      </div>
    </div>
  )
}

// ─── Modals ────────────────────────────────────────────────────

function LoginModal({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const digits = phoneDigits(phone)
    if (digits.length < 12) {
      setError('Введите номер телефона')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await loginPhone(digits)
      window.location.href = `/client/${res.slug}`
    } catch {
      setError('Аккаунт не найден')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: COLORS.white, borderRadius: 16, padding: '26px 24px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Войти в кабинет</h2>
        <input
          style={{ ...inputStyle, marginBottom: 12 }}
          value={phone}
          onChange={e => setPhone(formatPhoneInput(e.target.value))}
          placeholder="+7 ___ ___ __ __"
          autoFocus
        />
        {error && (
          <div style={{ padding: '8px 12px', background: '#faeaea', color: '#b03020', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <Btn variant="primary" onClick={submit} disabled={loading} style={{ width: '100%' }}>
          ВОЙТИ →
        </Btn>
      </div>
    </ModalOverlay>
  )
}

function SubmitModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (r: SubmitResult) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!name.trim() || !text.trim()) {
      setError('Заполните обязательные поля')
      return
    }
    const digits = phoneDigits(phone)
    if (digits.length < 12) {
      setError('Введите телефон')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await submitExternalOrder({ name, phone: digits, text })
      onSuccess(res)
      onClose()
    } catch {
      setError('Не удалось отправить заявку')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: COLORS.white, borderRadius: 16, padding: '26px 24px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Подать заявку (с регистрацией)</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, display: 'block', marginBottom: 5 }}>ФИО / КОМПАНИЯ *</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, display: 'block', marginBottom: 5 }}>ТЕЛЕФОН *</label>
            <input style={inputStyle} value={phone} onChange={e => setPhone(formatPhoneInput(e.target.value))} placeholder="+7 ___ ___ __ __" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, display: 'block', marginBottom: 5 }}>ТЕКСТ ЗАЯВКИ *</label>
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={text} onChange={e => setText(e.target.value)} />
          </div>
        </div>
        {error && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#faeaea', color: '#b03020', borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}
        <Btn variant="primary" onClick={submit} disabled={loading} style={{ width: '100%', marginTop: 16 }}>
          ОТПРАВИТЬ И ВОЙТИ →
        </Btn>
      </div>
    </ModalOverlay>
  )
}

function SuccessModal({ result, onClose }: { result: SubmitResult; onClose: () => void }) {
  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ background: COLORS.white, borderRadius: 16, padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e8f5ee', color: '#2e8a5e', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          ✓
        </div>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Заявка {result.cardId} принята!</h2>

        <div style={{ textAlign: 'left', display: 'grid', gap: 10, marginBottom: 18 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted }}>Кабинет</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input style={{ ...inputStyle, fontSize: 12 }} readOnly value={result.clientUrl} />
              <Btn size="sm" onClick={() => copyText(result.clientUrl)}>📋</Btn>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted }}>Трекинг</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input style={{ ...inputStyle, fontSize: 12 }} readOnly value={result.trackingUrl} />
              <Btn size="sm" onClick={() => copyText(result.trackingUrl)}>📋</Btn>
            </div>
          </div>
        </div>

        <Btn variant="primary" onClick={() => window.location.href = result.clientUrl}>
          Открыть кабинет →
        </Btn>
      </div>
    </ModalOverlay>
  )
}

// ─── Timeline ──────────────────────────────────────────────────

function Timeline({ stage }: { stage: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, gap: 4 }}>
      {TIMELINE_STEPS.map((label, i) => {
        const step = i + 1
        const done = stage > step
        const current = stage === step
        const future = stage < step
        return (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                margin: '0 auto 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                background: done ? '#e8f5ee' : current ? COLORS.primary : COLORS.borderLight,
                color: done ? '#2e8a5e' : current ? COLORS.white : COLORS.textLight,
                border: future ? `2px solid ${COLORS.border}` : 'none',
              }}
            >
              {done ? '✓' : step}
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: current ? COLORS.primary : done ? '#2e8a5e' : COLORS.textMuted, lineHeight: 1.2 }}>
              {label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────

export default function TrackingApp({ initialId }: { initialId?: string }) {
  const [searchId, setSearchId] = useState(initialId || '')
  const [trackData, setTrackData] = useState<TrackData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<TrackView>('track')
  const [hasId, setHasId] = useState(!!initialId)

  const [showLogin, setShowLogin] = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)

  const [changeText, setChangeText] = useState('')
  const [changePhone, setChangePhone] = useState('')
  const [changeSent, setChangeSent] = useState(false)
  const [changeLoading, setChangeLoading] = useState(false)

  const [submitName, setSubmitName] = useState('')
  const [submitPhone, setSubmitPhone] = useState('')
  const [submitText, setSubmitText] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [inlineSubmitResult, setInlineSubmitResult] = useState<SubmitResult | null>(null)

  const loadTrack = useCallback(async (id: string) => {
    if (!id.trim()) return
    setLoading(true)
    setError('')
    setChangeSent(false)
    try {
      const data = await fetchTrack(id.trim())
      setTrackData(data)
      setHasId(true)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.set('id', id.trim())
        window.history.replaceState({}, '', url.toString())
      }
    } catch {
      setError('Заказ не найден')
      setTrackData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialId) loadTrack(initialId)
  }, [initialId, loadTrack])

  async function handleChange() {
    if (!trackData || !changeText.trim()) return
    setChangeLoading(true)
    try {
      await submitTrackChange(trackData.id, changeText, phoneDigits(changePhone))
      setChangeSent(true)
      setChangeText('')
    } catch {
      setError('Не удалось отправить изменение')
    } finally {
      setChangeLoading(false)
    }
  }

  async function handleInlineSubmit() {
    if (!submitName.trim() || !submitText.trim()) {
      setSubmitError('Заполните обязательные поля')
      return
    }
    const digits = phoneDigits(submitPhone)
    if (digits.length < 12) {
      setSubmitError('Введите телефон')
      return
    }
    setSubmitLoading(true)
    setSubmitError('')
    try {
      const res = await submitExternalOrder({ name: submitName, phone: digits, text: submitText })
      setInlineSubmitResult(res)
    } catch {
      setSubmitError('Не удалось отправить заявку')
    } finally {
      setSubmitLoading(false)
    }
  }

  const isDelivered = trackData?.status === 'Доставлено'

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      {/* Topbar */}
      <div style={{ background: COLORS.white, borderBottom: `1px solid ${COLORS.border}`, padding: '14px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: COLORS.primary, color: COLORS.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>
            U
          </div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>U-Kan · Отслеживание</div>
        </div>
      </div>

      <div className="anim-fade" style={{ maxWidth: 920, margin: '0 auto', padding: '24px 20px 48px' }}>
        {!hasId ? (
          /* Landing */
          <div>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: COLORS.primary, color: COLORS.white, fontSize: 32, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                U
              </div>
              <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 700 }}>U-Kan</h1>
              <p style={{ margin: 0, color: COLORS.textMuted, fontSize: 14 }}>Система управления заказами · Логистика металла</p>
            </div>

            {/* Search */}
            <div style={{ background: COLORS.white, borderRadius: 16, padding: '22px 24px', border: `1px solid ${COLORS.border}`, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📦 Отследить заказ</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }}
                  value={searchId}
                  onChange={e => setSearchId(e.target.value)}
                  placeholder="C-054-060626"
                  onKeyDown={e => e.key === 'Enter' && loadTrack(searchId)}
                />
                <Btn variant="primary" onClick={() => loadTrack(searchId)} disabled={loading}>
                  Найти →
                </Btn>
              </div>
              {error && <div style={{ marginTop: 10, color: '#b03020', fontSize: 13 }}>{error}</div>}
            </div>

            {/* Two blocks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                style={{
                  background: COLORS.white,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 14,
                  padding: '20px 18px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>👤</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Войти в кабинет</div>
                <div style={{ fontSize: 12.5, color: COLORS.textMuted }}>По номеру телефона</div>
              </button>
              <button
                type="button"
                onClick={() => setShowSubmit(true)}
                style={{
                  background: COLORS.white,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 14,
                  padding: '20px 18px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>✨</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Новый клиент</div>
                <div style={{ fontSize: 12.5, color: COLORS.textMuted }}>Подать заявку с регистрацией</div>
              </button>
            </div>

            {/* How it works */}
            <div style={{ background: COLORS.bgCard, borderRadius: 14, padding: '20px 22px', border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Как это работает</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { n: '①', t: 'Подаёте заявку' },
                  { n: '②', t: 'Получаете ссылку' },
                  { n: '③', t: 'Отслеживаете' },
                ].map(s => (
                  <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                    <span style={{ fontWeight: 700, color: COLORS.primary }}>{s.n}</span>
                    <span>{s.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Track view with ID */
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['track', 'submit'] as TrackView[]).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 20,
                    border: view === v ? 'none' : `1px solid ${COLORS.border}`,
                    background: view === v ? COLORS.primary : COLORS.white,
                    color: view === v ? COLORS.white : COLORS.text,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {v === 'track' ? 'Отслеживание заказа' : 'Подать заявку'}
                </button>
              ))}
              <Btn variant="ghost" size="sm" onClick={() => { setHasId(false); setTrackData(null); setSearchId('') }} style={{ marginLeft: 'auto' }}>
                ← Назад
              </Btn>
            </div>

            {view === 'track' && (
              loading ? (
                <div style={{ height: 200, background: COLORS.borderLight, borderRadius: 16 }} />
              ) : trackData ? (
                <div>
                  {/* Hero */}
                  <div style={{ background: COLORS.white, borderRadius: 16, padding: '24px 26px', border: `1px solid ${COLORS.border}`, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 36 }}>{stageIcon(trackData.stage, trackData.status)}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <StatusBadge status={trackData.status} />
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 14 }}>{trackData.id}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 4 }}>
                          обновлено {fmtDateTime(trackData.createdAt)}
                        </div>
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: COLORS.primary }}>
                        {trackData.progress}%
                      </div>
                    </div>
                    <ProgressBar pct={trackData.progress} height={8} />
                    <Timeline stage={trackData.stage} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
                    {/* Left */}
                    <div>
                      <div style={{ background: COLORS.white, borderRadius: 14, padding: '18px 20px', border: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
                        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Позиции заказа</h3>
                        {trackData.positions.length === 0 ? (
                          <div style={{ fontSize: 13, color: COLORS.textMuted }}>Позиции формируются</div>
                        ) : (
                          <div style={{ display: 'grid', gap: 10 }}>
                            {trackData.positions.map((p, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < trackData.positions.length - 1 ? `1px solid ${COLORS.borderLight}` : 'none' }}>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                                  <div style={{ fontSize: 12, color: COLORS.textMuted }}>{p.qty} {p.unit}</div>
                                </div>
                                <StatusBadge status={p.status || 'В ожидании'} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {!isDelivered && (
                        <div style={{ background: COLORS.white, borderRadius: 14, padding: '18px 20px', border: `1px solid ${COLORS.border}` }}>
                          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Внести изменение</h3>
                          {changeSent ? (
                            <div style={{ padding: '14px 16px', background: '#e8f5ee', color: '#2e8a5e', borderRadius: 10, fontWeight: 600, fontSize: 13.5 }}>
                              ✓ Изменение отправлено менеджеру
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gap: 10 }}>
                              <textarea
                                style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                                value={changeText}
                                onChange={e => setChangeText(e.target.value)}
                                placeholder="Текст изменения..."
                              />
                              <input
                                style={inputStyle}
                                value={changePhone}
                                onChange={e => setChangePhone(formatPhoneInput(e.target.value))}
                                placeholder="+7 ___ ___ __ __"
                              />
                              <Btn variant="primary" onClick={handleChange} disabled={changeLoading || !changeText.trim()}>
                                Отправить
                              </Btn>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right */}
                    <div>
                      <div style={{ background: COLORS.white, borderRadius: 14, padding: '18px 20px', border: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
                        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Детали заказа</h3>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {trackData.details.map((d, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 12 }}>
                              <span style={{ color: COLORS.textMuted }}>{d.k}</span>
                              <span style={{ fontWeight: 600, textAlign: 'right' }}>{d.v}</span>
                            </div>
                          ))}
                          {trackData.details.length === 0 && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <span style={{ color: COLORS.textMuted }}>Заказчик</span>
                                <span style={{ fontWeight: 600 }}>{trackData.from}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <span style={{ color: COLORS.textMuted }}>Получатель</span>
                                <span style={{ fontWeight: 600 }}>{trackData.to || '—'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <span style={{ color: COLORS.textMuted }}>Позиций</span>
                                <span style={{ fontWeight: 600 }}>{trackData.positions.length}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {trackData.history.length > 0 && (
                        <div style={{ background: COLORS.white, borderRadius: 14, padding: '18px 20px', border: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
                          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>История</h3>
                          <div style={{ display: 'grid', gap: 10 }}>
                            {trackData.history.map((h, i) => (
                              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12.5 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.primary, marginTop: 6, flexShrink: 0 }} />
                                <div>
                                  <div>{h.action}</div>
                                  <div style={{ color: COLORS.textMuted, fontSize: 11 }}>{fmtDateTime(h.time)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ background: COLORS.dark, borderRadius: 14, padding: '18px 20px', color: COLORS.white }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Контакты</div>
                        <div style={{ fontSize: 13, color: '#cfc9c0' }}>Вопросы? Звоните:</div>
                        <a href="tel:+77273501200" style={{ color: COLORS.primary, fontWeight: 700, fontSize: 16, textDecoration: 'none', display: 'block', marginTop: 6 }}>
                          +7 727 350 12 00
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: COLORS.textMuted }}>{error || 'Загрузка...'}</div>
              )
            )}

            {view === 'submit' && (
              <div style={{ background: COLORS.white, borderRadius: 16, padding: '24px 26px', border: `1px solid ${COLORS.border}`, maxWidth: 520 }}>
                {inlineSubmitResult ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e8f5ee', color: '#2e8a5e', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>✓</div>
                    <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Заявка {inlineSubmitResult.cardId} принята!</h2>
                    <Btn variant="primary" onClick={() => window.location.href = inlineSubmitResult.clientUrl}>Открыть кабинет →</Btn>
                  </div>
                ) : (
                  <>
                    <h2 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 700 }}>Подать заявку</h2>
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, display: 'block', marginBottom: 5 }}>ФИО / КОМПАНИЯ *</label>
                        <input style={inputStyle} value={submitName} onChange={e => setSubmitName(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, display: 'block', marginBottom: 5 }}>ТЕЛЕФОН *</label>
                        <input style={inputStyle} value={submitPhone} onChange={e => setSubmitPhone(formatPhoneInput(e.target.value))} placeholder="+7 ___ ___ __ __" />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, display: 'block', marginBottom: 5 }}>ТЕКСТ ЗАЯВКИ *</label>
                        <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} value={submitText} onChange={e => setSubmitText(e.target.value)} />
                      </div>
                    </div>
                    {submitError && (
                      <div style={{ marginTop: 12, padding: '8px 12px', background: '#faeaea', color: '#b03020', borderRadius: 8, fontSize: 13 }}>{submitError}</div>
                    )}
                    <Btn variant="primary" onClick={handleInlineSubmit} disabled={submitLoading} style={{ width: '100%', marginTop: 18 }}>
                      ОТПРАВИТЬ ЗАЯВКУ →
                    </Btn>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showSubmit && <SubmitModal onClose={() => setShowSubmit(false)} onSuccess={r => setSubmitResult(r)} />}
      {submitResult && <SuccessModal result={submitResult} onClose={() => setSubmitResult(null)} />}
    </div>
  )
}