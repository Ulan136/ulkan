'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchAllOrders, fetchDashboard, fetchSettings, createOrder, orderAction, postAll,
  fetchHistory, createUser, updateUser, createProject, updateProject,
  createSpecProject, updateSpecProject, fetchSpecProjectAnalysis,
  fetchStock, fetchStockMovements, fetchDailyReports, updateDailyReport, logout,
  fetchNotifications, markNotificationRead,
} from '@/lib/api'
import {
  Order, Position, SessionUser, DashboardData, SettingsData,
  Project, SpecProject, AdminScreen, IncTab, ArchiveTab, SettingsTab, BookkeepingTab,
  User, DailyReport, AnalysisRow, Notification,
} from '@/lib/types'
import { cardProgress, cardSum, isOverdue, barColor, statusStyle, sourceStyle, sourceLabel, fmtMoney, fmtDate, fmtDateTime } from '@/lib/display'
import { COLORS } from '@/lib/colors'

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2300); return () => clearTimeout(t) }, [onClose])
  return <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#211f1c', color: '#fff', padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 9999, animation: 'uktoast .25s ease both', whiteSpace: 'nowrap' }}>{msg}</div>
}

function StatusBadge({ status }: { status: string }) {
  return <span style={statusStyle(status)}>{status}</span>
}

function SourceBadge({ source }: { source: string }) {
  return <span style={sourceStyle(source)}>{sourceLabel(source)}</span>
}

function ProgressBar({ pct, height = 5 }: { pct: number; height?: number }) {
  return (
    <div style={{ height, background: '#f1efec', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: barColor(pct), transition: 'width .3s', borderRadius: 4 }} />
    </div>
  )
}

function Btn({ children, onClick, variant = 'default', size = 'md', disabled = false, style: extraStyle }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'default' | 'danger' | 'ghost'
  size?: 'sm' | 'md'; disabled?: boolean; style?: React.CSSProperties
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', fontWeight: 600, borderRadius: 7, transition: 'opacity .15s', opacity: disabled ? .55 : 1,
    padding: size === 'sm' ? '4px 10px' : '8px 16px', fontSize: size === 'sm' ? 12 : 13,
    background: variant === 'primary' ? COLORS.primary : variant === 'danger' ? 'transparent' : variant === 'ghost' ? 'transparent' : COLORS.white,
    color: variant === 'primary' ? '#fff' : variant === 'danger' ? '#b03020' : COLORS.text,
    boxShadow: variant === 'default' ? '0 0 0 1.5px #d8d3cc' : variant === 'danger' ? '0 0 0 1.5px #e6dcd6' : 'none',
    ...extraStyle,
  }
  return <button style={base} onClick={onClick} disabled={disabled}>{children}</button>
}

const INP: React.CSSProperties = { width: '100%', padding: '9px 13px', borderRadius: 7, fontSize: 13, border: '1.5px solid #e6e2dc', background: '#fff', outline: 'none', fontFamily: 'inherit', color: '#26231f' }
const LBL: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#8a847c', marginBottom: 4, display: 'block', letterSpacing: '.04em' }

// ─── Модалка деталей карточки ────────────────────────────────────────────────

function CardDetailModal({ order, onClose, onAction, suppliers, toast }: {
  order: Order; onClose: () => void
  onAction: (id: string, action: string, payload?: Record<string, unknown>) => Promise<void>
  suppliers: { id: string; name: string }[]; toast: (m: string) => void
}) {
  const [history, setHistory] = useState<any[]>([])
  const [tab, setTab] = useState<'positions' | 'history'>('positions')
  const [editPos, setEditPos] = useState<string | null>(null)
  const [addPos, setAddPos] = useState(false)
  const [newPos, setNewPos] = useState({ name1c: '', oral: '', qty: '', unit: 'шт', price: '', resp: '', supplier: '', supplierId: '', status: 'В работе' })
  const pct = cardProgress(order)
  const sum = cardSum(order)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchHistory(order.id).then((h: any) => setHistory(h)).catch(() => {})
  }, [order.id])

  function copy(text: string) { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); toast('Скопировано!') }

  async function handleStatusChange(id: string, action: string, payload?: any) {
    await onAction(order.id, action, payload)
  }

  async function saveNewPos() {
    if (!newPos.name1c && !newPos.oral) return
    await onAction(order.id, 'addPos', { ...newPos, qty: Number(newPos.qty) || 0, price: Number(newPos.price) || 0, supplierId: newPos.supplierId || undefined })
    setAddPos(false); setNewPos({ name1c: '', oral: '', qty: '', unit: 'шт', price: '', resp: '', supplier: '', supplierId: '', status: 'В работе' })
    toast('Позиция добавлена')
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Шапка */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1efec', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15, color: COLORS.primary }}>{order.id}</span>
          <StatusBadge status={order.status} />
          <SourceBadge source={order.source} />
          <span style={{ fontSize: 11, color: '#8a847c', marginLeft: 4 }}>{fmtDate(order.createdAt)}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {order.isChanged && <span style={{ fontSize: 11, background: '#fff0ea', color: '#c0532a', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>⚡ ИЗМЕНЕНИЕ</span>}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a847c', fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
          {/* Маршрут и прогресс */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{order.from} → <span style={{ color: COLORS.primary }}>{order.to || '—'}</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <ProgressBar pct={pct} height={6} />
              <span style={{ fontSize: 13, fontWeight: 700, color: barColor(pct), flexShrink: 0 }}>{pct}%</span>
            </div>
            {order.deadline && <div style={{ fontSize: 12, color: '#8a847c' }}>Срок: {fmtDate(order.deadline)}</div>}
          </div>

          {/* Изменение от клиента */}
          {order.isChanged && (
            <div style={{ background: '#fff0ea', borderRadius: 10, padding: 14, marginBottom: 16, border: '1.5px solid #f3c8b0' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#c0532a', marginBottom: 6 }}>⚡ Изменение от клиента</div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>{order.changeText}</div>
              <div style={{ fontSize: 12, color: '#8a847c', marginBottom: 10 }}>Телефон: {order.changePhone}</div>
              <Btn size="sm" variant="primary" onClick={() => handleStatusChange(order.id, 'confirmChg')}>Подтвердить</Btn>
            </div>
          )}

          {/* Действия */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {order.screen === 'incoming' && !order.isDraft && !order.isCancelled && order.status === 'В ожидании' && (
              <Btn variant="primary" size="sm" onClick={() => handleStatusChange(order.id, 'accept')}>✓ Принять</Btn>
            )}
            {order.screen === 'reception' && order.block === 'waiting' && (
              <Btn variant="primary" size="sm" onClick={() => handleStatusChange(order.id, 'take')}>Взять в работу</Btn>
            )}
            {order.screen === 'reception' && order.block === 'processing' && (
              <Btn variant="primary" size="sm" onClick={() => handleStatusChange(order.id, 'process')}>→ В исходящие</Btn>
            )}
            {order.screen === 'outgoing' && (
              <>
                <Btn size="sm" onClick={() => handleStatusChange(order.id, 'markAll')}>✓ Все доставлены</Btn>
                <Btn size="sm" onClick={() => handleStatusChange(order.id, 'returnOut')}>← Вернуть</Btn>
              </>
            )}
            {order.screen === 'incoming' && order.toacc && (
              <Btn variant="primary" size="sm" onClick={() => handleStatusChange(order.id, 'sendAcc')}>→ К учёту</Btn>
            )}
            {order.screen === 'accounting' && (
              <>
                <Btn variant="primary" size="sm" onClick={() => handleStatusChange(order.id, 'postAcc')}>→ Бухгалтерия</Btn>
                <Btn size="sm" onClick={() => handleStatusChange(order.id, 'postpone')}>{order.postponed ? 'Снять откл.' : 'Отложить'}</Btn>
                <Btn size="sm" onClick={() => handleStatusChange(order.id, 'returnToAcc')}>← Вернуть</Btn>
              </>
            )}
            {order.screen === 'bookkeeping' && (
              <>
                <Btn size="sm" onClick={() => handleStatusChange(order.id, 'createDoc', { type: 'invoice' })} disabled={order.invoice}>
                  {order.invoice ? '✓ Счёт' : '↓ Счёт'}
                </Btn>
                <Btn size="sm" onClick={() => handleStatusChange(order.id, 'createDoc', { type: 'fact' })} disabled={order.fact}>
                  {order.fact ? '✓ Счёт-фактура' : '↓ Счёт-фактура'}
                </Btn>
                <Btn size="sm" onClick={() => handleStatusChange(order.id, 'post1C')} disabled={order.posted1C}>
                  {order.posted1C ? '✓ 1С' : 'Провести 1С'}
                </Btn>
                <Btn variant="primary" size="sm" onClick={() => handleStatusChange(order.id, 'sendArchive')} disabled={!order.posted1C}>
                  → Архив
                </Btn>
              </>
            )}
            {!order.isCancelled && order.screen !== 'archive' && (
              <Btn variant="danger" size="sm" onClick={() => handleStatusChange(order.id, 'cancel')}>Отменить</Btn>
            )}
            {order.isCancelled && (
              <Btn size="sm" onClick={() => handleStatusChange(order.id, 'restore')}>Восстановить</Btn>
            )}
            {order.screen === 'archive' && (
              <Btn size="sm" onClick={() => handleStatusChange(order.id, 'returnOut')}>↺ Вернуть из архива</Btn>
            )}
          </div>

          {/* Вкладки */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
            {(['positions', 'history'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: tab === t ? COLORS.primary : '#f1efec', color: tab === t ? '#fff' : '#8a847c' }}>
                {t === 'positions' ? `Позиции (${order.positions.length})` : 'История'}
              </button>
            ))}
          </div>

          {/* Позиции */}
          {tab === 'positions' && (
            <div>
              {order.positions.length === 0 && !addPos && (
                <div style={{ color: '#8a847c', fontSize: 13, marginBottom: 12, padding: '10px 0', fontStyle: 'italic' }}>
                  Позиции не сформированы {order.comment ? '— заявка из комментария' : ''}
                </div>
              )}
              {order.comment && order.positions.length === 0 && (
                <div style={{ background: '#f1efec', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: '#8a847c', marginBottom: 4 }}>КОММЕНТАРИЙ</div>
                  {order.comment}
                </div>
              )}
              {order.positions.map(p => (
                <div key={p.id} style={{ border: '1.5px solid #e6e2dc', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name1c || p.oral || '—'}</div>
                      {p.oral && p.name1c && <div style={{ fontSize: 12, color: '#8a847c' }}>{p.oral}</div>}
                      <div style={{ fontSize: 12, color: '#8a847c', marginTop: 2 }}>
                        {p.qty} {p.unit} · {p.supplier || '—'} · {p.resp || '—'}
                        {p.price > 0 && ` · ${fmtMoney(p.qty * p.price)}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <StatusBadge status={p.status} />
                      {p.late && <span style={{ fontSize: 10, background: '#faeaea', color: '#b03020', padding: '1px 6px', borderRadius: 20, fontWeight: 600 }}>ПРОСРОЧ.</span>}
                    </div>
                  </div>
                  {/* Быстрая смена статуса позиции */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['В работе', 'Готово к отгрузке', 'В пути', 'Доставлено'].filter(s => s !== p.status).map(s => (
                      <Btn key={s} size="sm" onClick={() => handleStatusChange(order.id, 'updatePos', { posId: p.id, status: s })}>→ {s}</Btn>
                    ))}
                    <Btn size="sm" variant="danger" onClick={() => handleStatusChange(order.id, 'deletePos', { posId: p.id })}>Удалить</Btn>
                  </div>
                  {p.payment && <div style={{ marginTop: 8, fontSize: 11, color: '#8a847c' }}>Оплата: {p.payment}</div>}
                </div>
              ))}

              {/* Сумма */}
              {sum > 0 && (
                <div style={{ background: '#fff8f5', border: '1.5px solid #f3c8b0', borderRadius: 10, padding: '12px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Сумма заказа</span>
                  <span style={{ fontWeight: 700, fontSize: 16, color: COLORS.primary }}>{fmtMoney(sum)}</span>
                </div>
              )}

              {/* Добавить позицию */}
              {addPos ? (
                <div style={{ border: '1.5px dashed #d4613a', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Новая позиция</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    {[
                      { f: 'name1c', l: 'НАИМ. 1С' }, { f: 'oral', l: 'УСТНОЕ НАЗВАНИЕ' },
                      { f: 'qty', l: 'КОЛ-ВО', t: 'number' }, { f: 'unit', l: 'ЕД.' },
                      { f: 'price', l: 'ЦЕНА', t: 'number' }, { f: 'resp', l: 'ОТВЕТСТВЕННЫЙ' },
                    ].map(({ f, l, t }) => (
                      <div key={f}>
                        <label style={LBL}>{l}</label>
                        <input style={INP} type={t || 'text'} value={(newPos as any)[f]} onChange={e => setNewPos(prev => ({ ...prev, [f]: e.target.value }))} />
                      </div>
                    ))}
                    <div>
                      <label style={LBL}>ПОСТАВЩИК</label>
                      <select style={INP} value={newPos.supplierId} onChange={e => {
                        const sup = suppliers.find(s => s.id === e.target.value)
                        setNewPos(prev => ({ ...prev, supplierId: e.target.value, supplier: sup?.name || '' }))
                      }}>
                        <option value="">—</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={LBL}>СТАТУС</label>
                      <select style={INP} value={newPos.status} onChange={e => setNewPos(prev => ({ ...prev, status: e.target.value }))}>
                        {['В работе', 'Готово к отгрузке', 'В пути', 'Доставлено'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn variant="primary" size="sm" onClick={saveNewPos}>Сохранить</Btn>
                    <Btn size="sm" onClick={() => setAddPos(false)}>Отмена</Btn>
                  </div>
                </div>
              ) : (
                <Btn size="sm" onClick={() => setAddPos(true)}>+ Добавить позицию</Btn>
              )}
            </div>
          )}

          {/* История */}
          {tab === 'history' && (
            <div>
              {history.length === 0 ? <div style={{ color: '#8a847c', fontSize: 13 }}>История пуста</div>
                : history.map((h: any, i: number) => (
                  <div key={h.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < history.length - 1 ? '1px solid #f1efec' : 'none', alignItems: 'flex-start' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? COLORS.primary : '#d8d3cc', marginTop: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{h.action}</div>
                      {h.detail && <div style={{ fontSize: 12, color: '#8a847c' }}>{h.detail}</div>}
                      <div style={{ fontSize: 11, color: '#8a847c' }}>{h.userName} · {fmtDateTime(h.createdAt)}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* Трекинг */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1efec', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input readOnly value={order.trackingLink} style={{ ...INP, flex: 1, color: '#8a847c', fontSize: 12 }} />
            <Btn size="sm" onClick={() => copy(order.trackingLink)}>{copied ? '✓' : '📋 Ссылка'}</Btn>
            <a href={order.trackingLink} target="_blank" rel="noreferrer" style={{ ...({ padding: '6px 12px', borderRadius: 7, background: '#f1efec', color: '#26231f', textDecoration: 'none', fontSize: 12, fontWeight: 600 } as React.CSSProperties) }}>Трекинг →</a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Карточка в списке ────────────────────────────────────────────────────────

function OrderCard({ order, onClick }: { order: Order; onClick: () => void }) {
  const pct = cardProgress(order)
  return (
    <div onClick={onClick} className="anim-fade" style={{ background: order.cold ? 'rgba(250,248,246,.6)' : '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 0 0 1.5px #e6e2dc', cursor: 'pointer', opacity: order.cold ? .6 : 1, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 12, color: COLORS.primary }}>{order.id}</span>
        {order.cold && <span>❄️</span>}
        <StatusBadge status={order.status} />
        <SourceBadge source={order.source} />
        {order.isChanged && <span style={{ fontSize: 10, background: '#fff0ea', color: '#c0532a', padding: '1px 7px', borderRadius: 20, fontWeight: 600 }}>⚡</span>}
        {isOverdue(order) && <span style={{ fontSize: 10, background: '#faeaea', color: '#b03020', padding: '1px 7px', borderRadius: 20, fontWeight: 600 }}>ПРОСРОЧ.</span>}
        {order.postponed && <span style={{ fontSize: 10, background: '#eef2ff', color: '#4a5aaa', padding: '1px 7px', borderRadius: 20, fontWeight: 600 }}>ОТЛОЖЕН</span>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8a847c' }}>{fmtDate(order.createdAt)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: order.positions.length > 0 ? 8 : 0 }}>
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{order.from}</span>
        {order.to && <span style={{ fontSize: 12, color: '#8a847c' }}>→ {order.to}</span>}
        <span style={{ fontSize: 13, fontWeight: 700, color: barColor(pct) }}>{pct}%</span>
      </div>
      {order.positions.length > 0 && <ProgressBar pct={pct} />}
      {order.comment && order.positions.length === 0 && <div style={{ fontSize: 12, color: '#8a847c', marginTop: 4 }}>{order.comment.slice(0, 80)}{order.comment.length > 80 ? '...' : ''}</div>}
      {cardSum(order) > 0 && <div style={{ fontSize: 11, color: '#8a847c', marginTop: 4 }}>{order.positions.length} позиций · {fmtMoney(cardSum(order))}</div>}
    </div>
  )
}

// ─── Главный компонент AdminApp ───────────────────────────────────────────────

interface Props { user: SessionUser }

export default function AdminApp({ user }: Props) {
  const [screen, setScreen] = useState<AdminScreen>('incoming')
  const [orders, setOrders] = useState<Order[]>([])
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [toast, setToast] = useState('')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)

  // Подэкраны
  const [incTab, setIncTab] = useState<IncTab>('new')
  const [archiveTab, setArchiveTab] = useState<ArchiveTab>('cards')
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('users')
  const [bookTab, setBookTab] = useState<BookkeepingTab>('cards')

  // Поиск/фильтр
  const [search, setSearch] = useState('')

  // Модалки создания
  const [showCreateCard, setShowCreateCard] = useState(false)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [showCreateSpec, setShowCreateSpec] = useState(false)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showUserResult, setShowUserResult] = useState<{ user: any; accessUrl: string } | null>(null)
  const [showSpecAnalysis, setShowSpecAnalysis] = useState<{ sp: SpecProject; analysis: AnalysisRow[] } | null>(null)
  const [showProjectDetail, setShowProjectDetail] = useState<Project | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([])

  // Склад
  const [stock, setStock] = useState<any[]>([])
  const [stockMovements, setStockMovements] = useState<any[]>([])

  // Форма создания карточки
  const [newCard, setNewCard] = useState({ from: '', to: '', comment: '', phone: '', deadline: '', projectId: '', specProjectId: '', contactId: '', source: 'admin_manual', isDraft: false })

  // Форма создания пользователя
  const [newUser, setNewUser] = useState({ name: '', role: 'client', email: '', phone: '', password: '', slug: '' })

  // Форма создания проекта
  const [newProject, setNewProject] = useState({ name: '', clientId: '', description: '' })

  // Форма создания СпецПроекта
  const [newSpec, setNewSpec] = useState({ name: '', clientId: '', description: '', items: [{ name: '', qty: '', unit: 'шт' }] })

  const showToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(''), 2300) }, [])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try { setOrders(await fetchAllOrders() as Order[]) } catch (e: any) { showToast(e.message) }
    finally { setLoading(false) }
  }, [showToast])

  const loadDashboard = useCallback(async () => {
    try { setDashboard(await fetchDashboard() as DashboardData) } catch {}
  }, [])

  const loadSettings = useCallback(async () => {
    try { setSettings(await fetchSettings() as SettingsData) } catch {}
  }, [])

  const loadNotifs = useCallback(async () => {
    try { setNotifications(await fetchNotifications() as Notification[]) } catch {}
  }, [])

  useEffect(() => {
    loadOrders(); loadDashboard(); loadSettings(); loadNotifs()
  }, [loadOrders, loadDashboard, loadSettings, loadNotifs])

  useEffect(() => {
    if (screen === 'warehouse') { fetchStock().then(s => setStock(s as any[])).catch(() => {}); fetchStockMovements().then(m => setStockMovements(m as any[])).catch(() => {}) }
    if (screen === 'bookkeeping') { fetchDailyReports().then(r => setDailyReports(r as DailyReport[])).catch(() => {}) }
  }, [screen])

  // Обновить карточку в локальном стейте после action
  async function handleAction(id: string, action: string, payload?: Record<string, unknown>) {
    try {
      const result = await orderAction(id, action, payload) as any
      if (result.order) {
        setOrders(prev => prev.map(o => o.id === id ? result.order : o))
        if (selectedOrder?.id === id) setSelectedOrder(result.order)
      }
      showToast('Готово!')
    } catch (e: any) { showToast(e.message || 'Ошибка') }
  }

  // Создать карточку
  async function handleCreateCard(e: React.FormEvent) {
    e.preventDefault()
    try {
      const o = await createOrder({ ...newCard, projectId: newCard.projectId || undefined, specProjectId: newCard.specProjectId || undefined, contactId: newCard.contactId || undefined }) as Order
      setOrders(prev => [o, ...prev])
      setShowCreateCard(false)
      setNewCard({ from: '', to: '', comment: '', phone: '', deadline: '', projectId: '', specProjectId: '', contactId: '', source: 'admin_manual', isDraft: false })
      showToast(`Карточка ${o.id} создана`)
    } catch (e: any) { showToast(e.message) }
  }

  // Создать пользователя
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    try {
      const r = await createUser(newUser) as any
      setShowCreateUser(false); setShowUserResult(r)
      setNewUser({ name: '', role: 'client', email: '', phone: '', password: '', slug: '' })
      loadSettings()
    } catch (e: any) { showToast(e.message) }
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return
    try {
      await updateUser(editingUser.id, { name: editingUser.name, role: editingUser.role, email: editingUser.email, phone: editingUser.phone, active: editingUser.active, slug: editingUser.slug })
      setEditingUser(null); loadSettings(); showToast('Пользователь обновлён')
    } catch (e: any) { showToast(e.message) }
  }

  // Создать проект
  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createProject(newProject); setShowCreateProject(false)
      setNewProject({ name: '', clientId: '', description: '' }); loadSettings(); showToast('Проект создан')
    } catch (e: any) { showToast(e.message) }
  }

  // Создать СпецПроект
  async function handleCreateSpec(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createSpecProject({ ...newSpec, items: newSpec.items.filter(i => i.name).map(i => ({ ...i, qty: Number(i.qty) || 0 })) })
      setShowCreateSpec(false); setNewSpec({ name: '', clientId: '', description: '', items: [{ name: '', qty: '', unit: 'шт' }] })
      loadSettings(); showToast('СпецПроект создан')
    } catch (e: any) { showToast(e.message) }
  }

  // ─── Фильтрация карточек ─────────────────────────────────────────────────

  function filterOrders(list: Order[]) {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(o =>
      o.id.toLowerCase().includes(q) || o.from.toLowerCase().includes(q) ||
      o.to.toLowerCase().includes(q) || o.comment.toLowerCase().includes(q) ||
      o.positions.some(p => (p.name1c + p.oral).toLowerCase().includes(q))
    )
  }

  const active = orders.filter(o => o.screen === 'incoming' && !o.isDraft && !o.isCancelled)
  const changed = orders.filter(o => o.isChanged && !o.isCancelled)
  const toacc = orders.filter(o => o.toacc && o.screen === 'incoming' && !o.isCancelled)
  const drafts = orders.filter(o => o.isDraft)
  const cancelled = orders.filter(o => o.isCancelled)
  const reception = orders.filter(o => o.screen === 'reception')
  const outgoing = orders.filter(o => o.screen === 'outgoing')
  const accounting = orders.filter(o => o.screen === 'accounting')
  const bookkeeping = orders.filter(o => o.screen === 'bookkeeping')
  const archived = orders.filter(o => o.screen === 'archive')
  const unreadNotifs = notifications.filter(n => !n.read).length

  // Подсчёт для сайдбара
  const counts: Record<AdminScreen, number> = {
    dashboard: 0,
    incoming: active.length,
    reception: reception.length,
    outgoing: outgoing.length,
    filter: 0,
    accounting: accounting.length,
    warehouse: 0,
    bookkeeping: bookkeeping.length,
    archive: archived.length,
    settings: 0,
  }

  // ─── Навигация ────────────────────────────────────────────────────────────

  const NAV: Array<{ key: AdminScreen; label: string; icon: string }> = [
    { key: 'dashboard', label: 'Дашборд', icon: '📊' },
    { key: 'incoming', label: 'Входящие', icon: '📥' },
    { key: 'reception', label: 'Приёмка', icon: '🔄' },
    { key: 'outgoing', label: 'Исходящие', icon: '📤' },
    { key: 'filter', label: 'Фильтр', icon: '🔍' },
    { key: 'accounting', label: 'К учёту', icon: '📋' },
    { key: 'warehouse', label: 'Склад', icon: '🏭' },
    { key: 'bookkeeping', label: 'Бухгалтерия', icon: '📒' },
    { key: 'archive', label: 'Архив', icon: '🗂' },
    { key: 'settings', label: 'Настройки', icon: '⚙️' },
  ]

  // ─── Рендер экранов ──────────────────────────────────────────────────────

  function renderOrders(list: Order[], emptyMsg = 'Нет карточек') {
    const filtered = filterOrders(list)
    if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#8a847c' }}>Загрузка...</div>
    if (filtered.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#8a847c', fontSize: 14 }}>{search ? 'Ничего не найдено' : emptyMsg}</div>
    return filtered.map(o => <OrderCard key={o.id} order={o} onClick={() => setSelectedOrder(o)} />)
  }

  function renderScreen() {
    switch (screen) {

      // ─── ДАШБОРД ─────────────────────────────────────────────────────────
      case 'dashboard':
        return (
          <div className="anim-fade">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 20 }}>Дашборд</div>
              <Btn onClick={loadDashboard}>⟳ Обновить</Btn>
            </div>
            {!dashboard ? <div style={{ color: '#8a847c' }}>Загрузка...</div> : (
              <>
                {/* KPI плитки */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Активных', val: dashboard.kpi.active, color: COLORS.primary },
                    { label: 'В работе', val: dashboard.kpi.inwork, color: '#c4a832' },
                    { label: 'Просрочено', val: dashboard.kpi.overdue, color: '#b03020' },
                    { label: 'Доставл. сегодня', val: dashboard.kpi.deliveredToday, color: '#2e8a5e' },
                    { label: 'Оборот сегодня', val: fmtMoney(dashboard.kpi.turnoverToday), color: '#4a5aaa' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                      <div style={{ fontSize: 11, color: '#8a847c', fontWeight: 600, marginBottom: 4 }}>{label.toUpperCase()}</div>
                      <div style={{ fontWeight: 700, fontSize: 22, color }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Поток + Активность */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Поток</div>
                    {[
                      { label: 'Входящие', val: dashboard.flow.incoming, screen: 'incoming' },
                      { label: 'Приёмка', val: dashboard.flow.reception, screen: 'reception' },
                      { label: 'Исходящие', val: dashboard.flow.outgoing, screen: 'outgoing' },
                      { label: 'К учёту', val: dashboard.flow.accounting, screen: 'accounting' },
                      { label: 'Бухгалтерия', val: dashboard.flow.bookkeeping, screen: 'bookkeeping' },
                      { label: 'Архив', val: dashboard.flow.archive, screen: 'archive' },
                    ].map(({ label, val, screen: s }) => (
                      <div key={label} onClick={() => setScreen(s as AdminScreen)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', cursor: 'pointer', borderBottom: '1px solid #f1efec' }}>
                        <span style={{ fontSize: 13 }}>{label}</span>
                        <span style={{ fontWeight: 700, fontSize: 15, color: val > 0 ? COLORS.primary : '#8a847c' }}>{val}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Последние события</div>
                    {dashboard.activity.length === 0 ? <div style={{ color: '#8a847c', fontSize: 13 }}>Нет данных</div>
                      : dashboard.activity.map((h: any, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: i < dashboard.activity.length - 1 ? '1px solid #f1efec' : 'none', alignItems: 'flex-start' }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: i === 0 ? COLORS.primary : '#d8d3cc', marginTop: 7, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 12 }}>{h.action}</div>
                            <div style={{ fontSize: 11, color: '#8a847c' }}>{h.userName} · {fmtDateTime(h.createdAt)}</div>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>

                {/* Внимание + Клиенты + СпецПроекты */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>⚡ Внимание</div>
                    {dashboard.attention.length === 0 ? <div style={{ color: '#8a847c', fontSize: 13 }}>Всё в порядке</div>
                      : dashboard.attention.map((a, i) => (
                        <div key={i} onClick={() => setScreen(a.screen as AdminScreen)} style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 8, cursor: 'pointer', background: '#faf8f6', border: `1.5px solid ${a.hue}22` }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: a.hue }}>{a.label}</div>
                          <div style={{ fontSize: 11, color: '#8a847c' }}>{a.sub}</div>
                        </div>
                      ))
                    }
                  </div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Топ клиенты</div>
                    {dashboard.topClients.map((c, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f1efec' }}>
                        <span style={{ fontSize: 13 }}>{c.name}</span>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{c.count}</span>
                          <span style={{ fontSize: 11, color: '#8a847c', marginLeft: 6 }}>{c.pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>СпецПроекты</div>
                    {dashboard.specProjects.length === 0 ? <div style={{ color: '#8a847c', fontSize: 13 }}>Нет активных</div>
                      : dashboard.specProjects.map((sp, i) => (
                        <div key={i} style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{sp.name}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: barColor(sp.pct) }}>{sp.pct}%</span>
                          </div>
                          <ProgressBar pct={sp.pct} />
                          <div style={{ fontSize: 11, color: '#8a847c', marginTop: 3 }}>{sp.cardCount} карточек</div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </>
            )}
          </div>
        )

      // ─── ВХОДЯЩИЕ ────────────────────────────────────────────────────────
      case 'incoming': {
        const tabMap: Record<IncTab, Order[]> = { new: active, changed, toacc, drafts, cancelled }
        const tabLabels: Record<IncTab, string> = { new: `Новые (${active.length})`, changed: `Изменения (${changed.length})`, toacc: `К учёту (${toacc.length})`, drafts: `Черновики (${drafts.length})`, cancelled: `Отменённые (${cancelled.length})` }
        return (
          <div className="anim-fade">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 20 }}>Входящие</div>
              <Btn variant="primary" onClick={() => setShowCreateCard(true)}>+ Создать карточку</Btn>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {(Object.keys(tabLabels) as IncTab[]).map(t => (
                <button key={t} onClick={() => setIncTab(t)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: incTab === t ? COLORS.primary : '#fff', color: incTab === t ? '#fff' : '#8a847c', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                  {tabLabels[t]}
                </button>
              ))}
            </div>
            {renderOrders(tabMap[incTab], 'Нет карточек')}
          </div>
        )
      }

      // ─── ПРИЁМКА ─────────────────────────────────────────────────────────
      case 'reception':
        return (
          <div className="anim-fade">
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>Приёмка <span style={{ fontSize: 14, color: '#8a847c', fontWeight: 400 }}>({reception.length})</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { title: 'Ожидают', list: reception.filter(o => o.block === 'waiting'), bg: '#fff' },
                { title: 'В обработке', list: reception.filter(o => o.block === 'processing'), bg: '#faf8f6' },
              ].map(({ title, list, bg }) => (
                <div key={title}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#8a847c', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>{title} ({list.length})</div>
                  {renderOrders(list, 'Пусто')}
                </div>
              ))}
            </div>
          </div>
        )

      // ─── ИСХОДЯЩИЕ ───────────────────────────────────────────────────────
      case 'outgoing':
        return (
          <div className="anim-fade">
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>Исходящие <span style={{ fontSize: 14, color: '#8a847c', fontWeight: 400 }}>({outgoing.length})</span></div>
            {renderOrders(outgoing, 'Нет карточек в работе')}
          </div>
        )

      // ─── ФИЛЬТР ──────────────────────────────────────────────────────────
      case 'filter': {
        const nonArchive = orders.filter(o => o.screen !== 'archive' && !o.isDraft && !o.isCancelled)
        return (
          <div className="anim-fade">
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>Фильтр</div>
            <div style={{ marginBottom: 16 }}>
              <input style={{ ...INP, maxWidth: 400 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск по ID, клиенту, номенклатуре..." />
            </div>
            {settings && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {/* По клиентам */}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#8a847c', marginBottom: 10, textTransform: 'uppercase' }}>Клиенты</div>
                  {[...new Set(nonArchive.map(o => o.from))].map(client => {
                    const clientOrders = nonArchive.filter(o => o.from === client)
                    return (
                      <div key={client} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 8, boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{client}</div>
                        <div style={{ fontSize: 12, color: '#8a847c' }}>{clientOrders.length} заявок</div>
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {clientOrders.slice(0, 3).map(o => (
                            <div key={o.id} onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: COLORS.primary, fontSize: 11 }}>{o.id}</span>
                              <StatusBadge status={o.status} />
                            </div>
                          ))}
                          {clientOrders.length > 3 && <div style={{ fontSize: 11, color: '#8a847c' }}>ещё {clientOrders.length - 3}...</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* По поставщикам */}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#8a847c', marginBottom: 10, textTransform: 'uppercase' }}>Поставщики</div>
                  {settings.suppliers.map(sup => {
                    const supOrders = nonArchive.filter(o => o.positions.some(p => p.supplier === sup.name))
                    if (supOrders.length === 0) return null
                    return (
                      <div key={sup.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 8, boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{sup.name}</div>
                        <div style={{ fontSize: 12, color: '#8a847c' }}>{supOrders.length} заказов · {sup.type}</div>
                      </div>
                    )
                  })}
                </div>
                {/* По проектам */}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#8a847c', marginBottom: 10, textTransform: 'uppercase' }}>Проекты</div>
                  {settings.projects.filter(p => p.status === 'active').map(prj => {
                    const prjOrders = nonArchive.filter(o => o.projectId === prj.id)
                    return (
                      <div key={prj.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 8, boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{prj.name}</div>
                        <div style={{ fontSize: 12, color: '#8a847c' }}>{prjOrders.length} карточек</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {search && <div style={{ marginTop: 16 }}>{renderOrders(filterOrders(nonArchive), 'Ничего не найдено')}</div>}
          </div>
        )
      }

      // ─── К УЧЁТУ ─────────────────────────────────────────────────────────
      case 'accounting':
        return (
          <div className="anim-fade">
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>К учёту <span style={{ fontSize: 14, color: '#8a847c', fontWeight: 400 }}>({accounting.length})</span></div>
            {renderOrders(accounting, 'Нет карточек к учёту')}
          </div>
        )

      // ─── СКЛАД ───────────────────────────────────────────────────────────
      case 'warehouse':
        return (
          <div className="anim-fade">
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 20 }}>Склад</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Остатки</div>
                {stock.length === 0 ? <div style={{ color: '#8a847c', fontSize: 13 }}>Нет данных</div>
                  : stock.map((s: any) => (
                    <div key={s.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', marginBottom: 8, boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: '#8a847c', marginTop: 4 }}>
                        На складе: <b>{s.qty} {s.unit}</b> · Резерв: {s.reserved} · Доступно: {Math.max(0, s.qty - s.reserved)}
                      </div>
                      <div style={{ fontSize: 11, color: '#8a847c' }}>{s.supplier?.name}</div>
                    </div>
                  ))
                }
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Движения</div>
                {stockMovements.slice(0, 20).map((m: any) => (
                  <div key={m.id} style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', marginBottom: 6, boxShadow: '0 0 0 1.5px #e6e2dc', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, background: m.type === 'income' ? '#e8f5ee' : m.type === 'reserve' ? '#eef2ff' : '#faeaea', color: m.type === 'income' ? '#2e8a5e' : m.type === 'reserve' ? '#4a5aaa' : '#b03020', padding: '1px 7px', borderRadius: 20, marginRight: 8 }}>{m.type}</span>
                      <span style={{ fontSize: 13 }}>{m.name}</span>
                    </div>
                    <span style={{ fontWeight: 600 }}>{m.qty}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      // ─── БУХГАЛТЕРИЯ ─────────────────────────────────────────────────────
      case 'bookkeeping':
        return (
          <div className="anim-fade">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 20 }}>Бухгалтерия</div>
              {user.role !== 'bookkeeper' && bookTab === 'cards' && (
                <Btn variant="primary" onClick={async () => { const r = await postAll() as any; showToast(`Проведено: ${r.count}`); loadOrders() }}>Провести все</Btn>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {(['cards', 'reports'] as BookkeepingTab[]).map(t => (
                <button key={t} onClick={() => setBookTab(t)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: bookTab === t ? COLORS.primary : '#fff', color: bookTab === t ? '#fff' : '#8a847c', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                  {t === 'cards' ? `Карточки (${bookkeeping.length})` : 'Отчёты логистов'}
                </button>
              ))}
            </div>
            {bookTab === 'cards' && renderOrders(bookkeeping, 'Нет карточек')}
            {bookTab === 'reports' && (
              <div>
                {dailyReports.length === 0 ? <div style={{ color: '#8a847c', fontSize: 13, padding: '20px 0' }}>Нет отчётов</div>
                  : dailyReports.map(r => (
                    <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: 18, marginBottom: 10, boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.logist?.name} · {fmtDate(r.date)}</div>
                          {r.comment && <div style={{ fontSize: 12, color: '#8a847c' }}>{r.comment}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <StatusBadge status={r.status === 'processing' ? 'В обработке' : r.status === 'done' ? 'Доставлено' : 'Архив'} />
                          {r.status === 'processing' && user.role !== 'logist' && (
                            <Btn size="sm" variant="primary" onClick={async () => { await updateDailyReport(r.id, 'done'); fetchDailyReports().then(rep => setDailyReports(rep as DailyReport[])); showToast('Отчёт принят') }}>Принять</Btn>
                          )}
                        </div>
                      </div>
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: '#8a847c', textAlign: 'left' }}>
                            {['От', 'Наим.', 'Приход', 'Коммент.', 'Кому', 'Расход', 'Коммент.', '№ накл.'].map(h => <th key={h} style={{ padding: '4px 8px', borderBottom: '1px solid #f1efec' }}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {r.rows.map(row => (
                            <tr key={row.id}>
                              {[row.fromWho, row.name, row.qtyIn, row.commentIn, row.toWho, row.qtyOut, row.commentOut, row.invoiceNum].map((v, i) => (
                                <td key={i} style={{ padding: '4px 8px', borderBottom: '1px solid #f1efec' }}>{v || '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        )

      // ─── АРХИВ ───────────────────────────────────────────────────────────
      case 'archive': {
        const archProjects = settings?.projects.filter(p => p.status === 'archive') || []
        const archSpecs = settings?.specProjects.filter(sp => sp.status === 'archive') || []
        return (
          <div className="anim-fade">
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>Архив</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {([['cards', `Карточки (${archived.length})`], ['projects', `Проекты (${archProjects.length})`], ['specprojects', `СпецПроекты (${archSpecs.length})`]] as const).map(([t, l]) => (
                <button key={t} onClick={() => setArchiveTab(t)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: archiveTab === t ? COLORS.primary : '#fff', color: archiveTab === t ? '#fff' : '#8a847c', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                  {l}
                </button>
              ))}
            </div>
            {archiveTab === 'cards' && renderOrders(archived, 'Архив пуст')}
            {archiveTab === 'projects' && (
              <div>{archProjects.map(p => <div key={p.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', marginBottom: 8, boxShadow: '0 0 0 1.5px #e6e2dc' }}><div style={{ fontWeight: 600 }}>{p.id} · {p.name}</div><div style={{ fontSize: 12, color: '#8a847c' }}>{p.description}</div></div>)}</div>
            )}
            {archiveTab === 'specprojects' && (
              <div>{archSpecs.map(sp => <div key={sp.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', marginBottom: 8, boxShadow: '0 0 0 1.5px #e6e2dc' }}><div style={{ fontWeight: 600 }}>{sp.id} · {sp.name}</div></div>)}</div>
            )}
          </div>
        )
      }

      // ─── НАСТРОЙКИ ───────────────────────────────────────────────────────
      case 'settings': {
        const stabs: Array<[SettingsTab, string]> = [['users', `Пользователи`], ['projects', 'Проекты'], ['specprojects', 'СпецПроекты'], ['nomenclature', 'Номенклатура'], ['payment', 'Оплата']]
        const roleColors: Record<string, { bg: string; color: string }> = {
          super_admin: { bg: '#eef2ff', color: '#4a5aaa' }, bookkeeper: { bg: '#e8f5ee', color: '#2e8a5e' },
          logist: { bg: '#fff0ea', color: '#c0532a' }, supplier_client: { bg: '#f3eeff', color: '#7a3aaa' }, client: { bg: '#eef8ff', color: '#2a7aaa' },
        }
        const roleLabel: Record<string, string> = { super_admin: 'Супер-Админ', bookkeeper: 'Бухгалтер', logist: 'Логист', supplier_client: 'Поставщик/заказчик', client: 'Клиент' }
        const base = typeof window !== 'undefined' ? window.location.origin : ''

        return (
          <div className="anim-fade">
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>Настройки</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
              {stabs.map(([t, l]) => (
                <button key={t} onClick={() => setSettingsTab(t)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: settingsTab === t ? COLORS.primary : '#fff', color: settingsTab === t ? '#fff' : '#8a847c', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                  {l}
                </button>
              ))}
            </div>

            {!settings ? <div style={{ color: '#8a847c' }}>Загрузка...</div> : (
              <>
                {/* Пользователи */}
                {settingsTab === 'users' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                      <Btn variant="primary" onClick={() => setShowCreateUser(true)}>+ Добавить пользователя</Btn>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                      <thead><tr style={{ background: '#f1efec' }}>
                        {['ИМЯ', 'РОЛЬ', 'КОМПАНИЯ', 'ДОСТУП', 'СТАТУС', ''].map(h => <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#8a847c', textAlign: 'left' }}>{h}</th>)}
                      </tr></thead>
                      <tbody>{settings.users.map((u, i) => {
                        const rc = roleColors[u.role] || roleColors.client
                        const accessUrl = (u.role === 'client' || u.role === 'supplier_client') ? `${base}/client/${u.slug}` : u.role === 'logist' ? `${base}/rsp/${u.slug}` : ''
                        return (
                          <tr key={u.id} style={{ borderTop: i > 0 ? '1px solid #f1efec' : 'none' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{u.name}</td>
                            <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: rc.bg, color: rc.color }}>{roleLabel[u.role] || u.role}</span></td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: '#8a847c' }}>{u.companyId ? settings.users.find(x => x.id === u.companyId)?.name || '—' : '—'}</td>
                            <td style={{ padding: '10px 14px' }}>
                              {accessUrl && <a href={accessUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: COLORS.primary, textDecoration: 'none' }}>Открыть</a>}
                              {(u.phone || u.email) && <span style={{ fontSize: 12, color: '#8a847c', marginLeft: 8 }}>{u.phone || u.email}</span>}
                            </td>
                            <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: u.active ? '#e8f5ee' : '#faeaea', color: u.active ? '#2e8a5e' : '#b03020' }}>{u.active ? 'Активен' : 'Отключён'}</span></td>
                            <td style={{ padding: '10px 14px' }}>
                              {user.role === 'super_admin' && <Btn size="sm" onClick={() => setEditingUser(u)}>Изменить</Btn>}
                            </td>
                          </tr>
                        )
                      })}</tbody>
                    </table>
                  </div>
                )}

                {/* Проекты */}
                {settingsTab === 'projects' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                      <Btn variant="primary" onClick={() => setShowCreateProject(true)}>+ Создать проект</Btn>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                      <thead><tr style={{ background: '#f1efec' }}>
                        {['ID', 'НАЗВАНИЕ', 'ТИП', 'ЗАКАЗЧИК', 'КАРТОЧЕК', 'СТАТУС'].map(h => <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#8a847c', textAlign: 'left' }}>{h}</th>)}
                      </tr></thead>
                      <tbody>{settings.projects.map((p, i) => (
                        <tr key={p.id} style={{ borderTop: i > 0 ? '1px solid #f1efec' : 'none', cursor: 'pointer' }} onClick={() => setShowProjectDetail(p)}>
                          <td style={{ padding: '10px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: COLORS.primary }}>{p.id}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{p.name}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#8a847c' }}>Проект</td>
                          <td style={{ padding: '10px 14px', fontSize: 12 }}>{settings.users.find(u => u.id === p.clientId)?.name || '—'}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13 }}>{(p as any)._count?.orders || 0}</td>
                          <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: p.status === 'active' ? '#e8f5ee' : '#eef2ff', color: p.status === 'active' ? '#2e8a5e' : '#4a5aaa' }}>{p.status === 'active' ? 'Активен' : 'Архив'}</span></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}

                {/* СпецПроекты */}
                {settingsTab === 'specprojects' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                      <Btn variant="primary" onClick={() => setShowCreateSpec(true)}>+ Создать СпецПроект</Btn>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                      <thead><tr style={{ background: '#f1efec' }}>
                        {['ID', 'НАЗВАНИЕ', 'ЗАКАЗЧИК', 'КАРТОЧЕК', 'ПРОГРЕСС', 'СТАТУС', ''].map(h => <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#8a847c', textAlign: 'left' }}>{h}</th>)}
                      </tr></thead>
                      <tbody>{settings.specProjects.map((sp, i) => (
                        <tr key={sp.id} style={{ borderTop: i > 0 ? '1px solid #f1efec' : 'none' }}>
                          <td style={{ padding: '10px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: COLORS.primary }}>{sp.id}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{sp.name}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12 }}>{settings.users.find(u => u.id === sp.clientId)?.name || '—'}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13 }}>{(sp as any)._count?.orders || 0}</td>
                          <td style={{ padding: '10px 14px', width: 120 }}><ProgressBar pct={0} /></td>
                          <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: sp.status === 'active' ? '#e8f5ee' : '#eef2ff', color: sp.status === 'active' ? '#2e8a5e' : '#4a5aaa' }}>{sp.status === 'active' ? 'Активен' : 'Архив'}</span></td>
                          <td style={{ padding: '10px 14px' }}><Btn size="sm" onClick={async () => { const analysis = await fetchSpecProjectAnalysis(sp.id) as AnalysisRow[]; setShowSpecAnalysis({ sp, analysis }) }}>Аналитика</Btn></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}

                {/* Номенклатура */}
                {settingsTab === 'nomenclature' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                    <thead><tr style={{ background: '#f1efec' }}>
                      {['НАИМЕНОВАНИЕ 1С', 'ЕД.', 'КАТЕГОРИЯ'].map(h => <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#8a847c', textAlign: 'left' }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{settings.nomenclature.map((n, i) => (
                      <tr key={n.id} style={{ borderTop: i > 0 ? '1px solid #f1efec' : 'none' }}>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{n.name}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#8a847c' }}>{n.unit}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#8a847c' }}>{n.cat}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}

                {/* Оплата */}
                {settingsTab === 'payment' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                    <thead><tr style={{ background: '#f1efec' }}>
                      {['СТАТУС', 'АКТИВЕН'].map(h => <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#8a847c', textAlign: 'left' }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{settings.paymentStatuses.map((ps, i) => (
                      <tr key={ps.id} style={{ borderTop: i > 0 ? '1px solid #f1efec' : 'none' }}>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{ps.name}</td>
                        <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: ps.active ? '#e8f5ee' : '#faeaea', color: ps.active ? '#2e8a5e' : '#b03020' }}>{ps.active ? 'Да' : 'Нет'}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </>
            )}
          </div>
        )
      }

      default: return null
    }
  }

  // ─── Layout ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', background: COLORS.bg, fontFamily: "'Golos Text', system-ui, sans-serif", overflow: 'hidden' }}>
      {toast && <Toast msg={toast} onClose={() => setToast('')} />}

      {/* Сайдбар */}
      <div style={{ width: 220, background: COLORS.sidebar.bg, display: 'flex', flexDirection: 'column', flexShrink: 0, borderRight: `1px solid ${COLORS.sidebar.border}` }}>
        {/* Лого */}
        <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${COLORS.sidebar.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: COLORS.primary, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>U</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>U-Kan</div>
              <div style={{ color: COLORS.sidebar.muted, fontSize: 10 }}>v1.0</div>
            </div>
          </div>
        </div>

        {/* Навигация */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV.map(({ key, label, icon }) => {
            const isActive = screen === key
            const count = counts[key]
            return (
              <button key={key} onClick={() => setScreen(key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', border: 'none', background: isActive ? 'rgba(212,97,58,.15)' : 'transparent', color: isActive ? COLORS.sidebar.active : COLORS.sidebar.text, cursor: 'pointer', fontFamily: 'inherit', fontWeight: isActive ? 700 : 400, fontSize: 13, textAlign: 'left', borderLeft: `3px solid ${isActive ? COLORS.sidebar.active : 'transparent'}` }}>
                <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{icon}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {count > 0 && <span style={{ background: isActive ? COLORS.primary : COLORS.sidebar.badge, color: isActive ? '#fff' : COLORS.sidebar.text, fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>{count}</span>}
              </button>
            )
          })}
        </nav>

        {/* Футер */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${COLORS.sidebar.border}` }}>
          <div style={{ color: COLORS.sidebar.text, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{user.name}</div>
          <div style={{ color: COLORS.sidebar.muted, fontSize: 11, marginBottom: 10 }}>{user.role === 'super_admin' ? 'Супер-Админ' : 'Бухгалтер'}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={loadOrders} style={{ flex: 1, background: COLORS.sidebar.badge, border: 'none', borderRadius: 7, padding: '6px', color: COLORS.sidebar.text, cursor: 'pointer', fontSize: 13 }}>⟳</button>
            <button onClick={logout} style={{ flex: 1, background: COLORS.sidebar.badge, border: 'none', borderRadius: 7, padding: '6px', color: COLORS.sidebar.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Выйти</button>
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e6e2dc', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{NAV.find(n => n.key === screen)?.label}</div>
            <div style={{ fontSize: 11, color: '#8a847c' }}>{new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>

          {/* Пилюли */}
          <div style={{ display: 'flex', gap: 8, marginLeft: 20 }}>
            {[
              { label: `Активных: ${orders.filter(o => !o.isDraft && !o.isCancelled && o.screen !== 'archive').length}`, bg: '#fff0ea', color: '#c0532a' },
              { label: `В работе: ${outgoing.length}`, bg: '#fdf8e1', color: '#8a6f00' },
              { label: `Просрочено: ${orders.filter(isOverdue).length}`, bg: '#faeaea', color: '#b03020' },
              { label: `К учёту: ${accounting.length}`, bg: '#e8f5ee', color: '#2e8a5e' },
            ].map(({ label, bg, color }) => (
              <span key={label} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: bg, color, fontWeight: 600 }}>{label}</span>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Поиск */}
            <input style={{ ...INP, width: 220 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Поиск..." />
            {/* Уведомления */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowNotifs(!showNotifs)} style={{ padding: '7px 10px', background: '#fff', border: '1.5px solid #e6e2dc', borderRadius: 8, cursor: 'pointer', fontSize: 16, position: 'relative' }}>
                🔔
                {unreadNotifs > 0 && <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', background: COLORS.primary }} />}
              </button>
              {showNotifs && (
                <div style={{ position: 'absolute', top: 40, right: 0, background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,.12)', width: 320, maxHeight: 400, overflowY: 'auto', zIndex: 500, border: '1.5px solid #e6e2dc' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1efec', fontWeight: 700, fontSize: 14 }}>Уведомления</div>
                  {notifications.length === 0 ? <div style={{ padding: 16, color: '#8a847c', fontSize: 13 }}>Нет уведомлений</div>
                    : notifications.slice(0, 15).map(n => (
                      <div key={n.id} onClick={() => markNotificationRead(n.id).then(loadNotifs)} style={{ padding: '10px 16px', borderBottom: '1px solid #f1efec', cursor: 'pointer', background: n.read ? '#fff' : '#fff8f5' }}>
                        <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.text}</div>
                        <div style={{ fontSize: 11, color: '#8a847c', marginTop: 2 }}>{fmtDateTime(n.createdAt)}</div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
            <button onClick={loadOrders} style={{ padding: '7px 12px', background: '#fff', border: '1.5px solid #e6e2dc', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>⟳</button>
          </div>
        </div>

        {/* Контент */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {renderScreen()}
        </div>
      </div>

      {/* Модалка деталей карточки */}
      {selectedOrder && (
        <CardDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onAction={handleAction}
          suppliers={settings?.suppliers || []}
          toast={showToast}
        />
      )}

      {/* Модалка создания карточки */}
      {showCreateCard && (
        <div onClick={() => setShowCreateCard(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Создать карточку</div>
            <form onSubmit={handleCreateCard} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={LBL}>ОТ КОГО *</label><input style={INP} value={newCard.from} onChange={e => setNewCard(p => ({ ...p, from: e.target.value }))} required /></div>
                <div><label style={LBL}>КУДА</label><input style={INP} value={newCard.to} onChange={e => setNewCard(p => ({ ...p, to: e.target.value }))} /></div>
                <div><label style={LBL}>ТЕЛЕФОН</label><input style={INP} value={newCard.phone} onChange={e => setNewCard(p => ({ ...p, phone: e.target.value }))} /></div>
                <div><label style={LBL}>СРОК</label><input style={INP} type="date" value={newCard.deadline} onChange={e => setNewCard(p => ({ ...p, deadline: e.target.value }))} /></div>
                <div>
                  <label style={LBL}>ЗАКАЗЧИК</label>
                  <select style={INP} value={newCard.contactId} onChange={e => setNewCard(p => ({ ...p, contactId: e.target.value }))}>
                    <option value="">—</option>
                    {settings?.users.filter(u => u.role === 'client' || u.role === 'supplier_client').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LBL}>ПРОЕКТ</label>
                  <select style={INP} value={newCard.projectId} onChange={e => setNewCard(p => ({ ...p, projectId: e.target.value }))}>
                    <option value="">—</option>
                    {settings?.projects.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={LBL}>КОММЕНТАРИЙ / ЗАЯВКА</label><textarea style={{ ...INP, minHeight: 80, resize: 'vertical' }} value={newCard.comment} onChange={e => setNewCard(p => ({ ...p, comment: e.target.value }))} /></div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Btn onClick={() => setShowCreateCard(false)}>Отмена</Btn>
                <Btn variant="primary" onClick={() => {}}>Создать →</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка создания пользователя */}
      {showCreateUser && (
        <div onClick={() => setShowCreateUser(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Добавить пользователя</div>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={LBL}>ИМЯ *</label><input style={INP} value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} required /></div>
              <div>
                <label style={LBL}>РОЛЬ</label>
                <select style={INP} value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                  {[['super_admin', 'Супер-Админ'], ['bookkeeper', 'Бухгалтер'], ['logist', 'Логист'], ['supplier_client', 'Поставщик/заказчик'], ['client', 'Клиент']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={LBL}>EMAIL</label><input style={INP} type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} /></div>
                <div><label style={LBL}>ТЕЛЕФОН</label><input style={INP} value={newUser.phone} onChange={e => setNewUser(p => ({ ...p, phone: e.target.value }))} /></div>
                <div><label style={LBL}>ПАРОЛЬ</label><input style={INP} type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} /></div>
                <div><label style={LBL}>SLUG (URL)</label><input style={INP} value={newUser.slug} onChange={e => setNewUser(p => ({ ...p, slug: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Btn onClick={() => setShowCreateUser(false)}>Отмена</Btn>
                <Btn variant="primary">Создать →</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Результат создания пользователя */}
      {showUserResult && (
        <div onClick={() => setShowUserResult(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Пользователь создан!</div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>{showUserResult.user.name}</div>
            {showUserResult.accessUrl && (
              <div style={{ background: '#f1efec', borderRadius: 8, padding: 12, margin: '16px 0', fontSize: 13, wordBreak: 'break-all' }}>
                {showUserResult.accessUrl}
                <button onClick={() => { navigator.clipboard.writeText(showUserResult.accessUrl); showToast('Скопировано!') }} style={{ marginLeft: 8, border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>📋</button>
              </div>
            )}
            <Btn variant="primary" onClick={() => setShowUserResult(null)}>Закрыть</Btn>
          </div>
        </div>
      )}

      {/* Редактирование пользователя */}
      {editingUser && (
        <div onClick={() => setEditingUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Изменить пользователя</div>
            <form onSubmit={handleEditUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={LBL}>ИМЯ</label><input style={INP} value={editingUser.name} onChange={e => setEditingUser(p => p ? ({ ...p, name: e.target.value }) : p)} /></div>
              <div>
                <label style={LBL}>РОЛЬ</label>
                <select style={INP} value={editingUser.role} onChange={e => setEditingUser(p => p ? ({ ...p, role: e.target.value }) : p)}>
                  {[['super_admin', 'Супер-Админ'], ['bookkeeper', 'Бухгалтер'], ['logist', 'Логист'], ['supplier_client', 'Поставщик/заказчик'], ['client', 'Клиент']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={LBL}>EMAIL</label><input style={INP} value={editingUser.email || ''} onChange={e => setEditingUser(p => p ? ({ ...p, email: e.target.value }) : p)} /></div>
                <div><label style={LBL}>ТЕЛЕФОН</label><input style={INP} value={editingUser.phone || ''} onChange={e => setEditingUser(p => p ? ({ ...p, phone: e.target.value }) : p)} /></div>
                <div><label style={LBL}>SLUG</label><input style={INP} value={editingUser.slug || ''} onChange={e => setEditingUser(p => p ? ({ ...p, slug: e.target.value }) : p)} /></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={editingUser.active} onChange={e => setEditingUser(p => p ? ({ ...p, active: e.target.checked }) : p)} />
                <span style={{ fontSize: 13 }}>Активен</span>
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Btn onClick={() => setEditingUser(null)}>Отмена</Btn>
                <Btn variant="primary">Сохранить →</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка создания проекта */}
      {showCreateProject && (
        <div onClick={() => setShowCreateProject(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Создать проект</div>
            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={LBL}>НАЗВАНИЕ *</label><input style={INP} value={newProject.name} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} required /></div>
              <div>
                <label style={LBL}>ЗАКАЗЧИК</label>
                <select style={INP} value={newProject.clientId} onChange={e => setNewProject(p => ({ ...p, clientId: e.target.value }))}>
                  <option value="">—</option>
                  {settings?.users.filter(u => u.role === 'client' || u.role === 'supplier_client').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div><label style={LBL}>ОПИСАНИЕ</label><textarea style={{ ...INP, minHeight: 70, resize: 'vertical' }} value={newProject.description} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} /></div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Btn onClick={() => setShowCreateProject(false)}>Отмена</Btn>
                <Btn variant="primary">Сохранить →</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка создания СпецПроекта */}
      {showCreateSpec && (
        <div onClick={() => setShowCreateSpec(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Создать СпецПроект</div>
            <form onSubmit={handleCreateSpec} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={LBL}>НАЗВАНИЕ *</label><input style={INP} value={newSpec.name} onChange={e => setNewSpec(p => ({ ...p, name: e.target.value }))} required /></div>
              <div>
                <label style={LBL}>ЗАКАЗЧИК</label>
                <select style={INP} value={newSpec.clientId} onChange={e => setNewSpec(p => ({ ...p, clientId: e.target.value }))}>
                  <option value="">—</option>
                  {settings?.users.filter(u => u.role === 'client' || u.role === 'supplier_client').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div><label style={LBL}>ОПИСАНИЕ</label><textarea style={{ ...INP, minHeight: 60, resize: 'vertical' }} value={newSpec.description} onChange={e => setNewSpec(p => ({ ...p, description: e.target.value }))} /></div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>СМЕТА</div>
              {newSpec.items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'end' }}>
                  <div><label style={LBL}>НАИМ.</label><input style={INP} value={item.name} onChange={e => setNewSpec(p => ({ ...p, items: p.items.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x) }))} /></div>
                  <div><label style={LBL}>КОЛ-ВО</label><input style={{ ...INP, width: 80 }} type="number" value={item.qty} onChange={e => setNewSpec(p => ({ ...p, items: p.items.map((x, idx) => idx === i ? { ...x, qty: e.target.value } : x) }))} /></div>
                  <div><label style={LBL}>ЕД.</label><input style={{ ...INP, width: 60 }} value={item.unit} onChange={e => setNewSpec(p => ({ ...p, items: p.items.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x) }))} /></div>
                  <button type="button" onClick={() => setNewSpec(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b03020', fontSize: 20, padding: '8px 4px', alignSelf: 'flex-end' }}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => setNewSpec(p => ({ ...p, items: [...p.items, { name: '', qty: '', unit: 'шт' }] }))} style={{ border: '1.5px dashed #e6e2dc', borderRadius: 7, padding: '8px', background: 'none', cursor: 'pointer', fontSize: 13, color: '#8a847c', fontFamily: 'inherit' }}>+ Добавить позицию</button>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Btn onClick={() => setShowCreateSpec(false)}>Отмена</Btn>
                <Btn variant="primary">Сохранить СпецПроект →</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Аналитика СпецПроекта */}
      {showSpecAnalysis && (
        <div onClick={() => setShowSpecAnalysis(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="anim-pop" style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 600, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div><div style={{ fontWeight: 700, fontSize: 18 }}>{showSpecAnalysis.sp.name}</div><div style={{ fontSize: 12, color: '#8a847c' }}>Смета vs Собрано</div></div>
              <button onClick={() => setShowSpecAnalysis(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#8a847c' }}>×</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f1efec' }}>
                {['НАИМ.', 'НУЖНО', 'ЕД.', 'СОБРАНО', 'ОСТАТОК', '%'].map(h => <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#8a847c', textAlign: 'left' }}>{h}</th>)}
              </tr></thead>
              <tbody>{showSpecAnalysis.analysis.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f1efec' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>{row.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{row.needed}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#8a847c' }}>{row.unit}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: barColor(row.pct) }}>{row.collected}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{row.remaining}</td>
                  <td style={{ padding: '10px 14px', width: 80 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ProgressBar pct={row.pct} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: barColor(row.pct), flexShrink: 0 }}>{row.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
