'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchAllOrders, fetchDashboard, fetchSettings, createOrder, orderAction, postAll,
  fetchHistory, createUser, updateUser, createProject,
  createSpecProject, fetchSpecProjectAnalysis,
  fetchStock, fetchStockMovements, fetchDailyReports, updateDailyReport, logout,
  fetchNotifications, markNotificationRead,
} from '@/lib/api'
import {
  Order, Position, SessionUser, DashboardData, SettingsData,
  Project, SpecProject, AdminScreen, IncTab, ArchiveTab, SettingsTab, BookkeepingTab,
  User, DailyReport, AnalysisRow, Notification,
} from '@/lib/types'
import { cardProgress, posPct, cardSum, isOverdue, barColor, statusStyle, sourceStyle, sourceLabel, fmtMoney, fmtDate, fmtDateTime } from '@/lib/display'
import { todayLocal } from '@/lib/dates'
import { useLiveData } from '@/lib/live'
import { COLORS } from '@/lib/colors'
import FilterScreen from '@/components/FilterScreen'
import WarehouseScreen from '@/components/WarehouseScreen'
import NomSearch from '@/components/NomSearch'
import NomenclatureScreen from '@/components/NomenclatureScreen'
import CardChat from '@/components/CardChat'
import ChatWidget from '@/components/ChatWidget'

// ─── Утилиты v2.2 ───────────────────────────────────────────────────────────

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

function UnifiedSelect({ value, onChange, placeholder = '— выберите —', style: st, settings: s, roles }: {
  value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties; settings: any; roles?: string[]
}) {
  const allUsers = s?.users || []
  const show = (r: string) => !roles || roles.includes(r)  // roles задан → показываем только эти роли
  const lg = show('logist') ? allUsers.filter((u: any) => u.role === 'logist' && u.active !== false) : []
  const sp = show('supplier_client') ? allUsers.filter((u: any) => u.role === 'supplier_client' && u.active !== false) : []
  const cl = show('client') ? allUsers.filter((u: any) => u.role === 'client' && u.active !== false) : []
  const br = show('branch') ? allUsers.filter((u: any) => u.role === 'branch' && u.active !== false) : []
  const INP2: React.CSSProperties = { padding: '9px 12px', borderRadius: 8, fontSize: 13, border: '1.5px solid #e6e2dc', background: '#fff', outline: 'none', fontFamily: 'inherit', width: '100%' }
  return (
    <select style={{ ...INP2, ...st }} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {lg.length > 0 && <optgroup label="Логисты">{lg.map((l: any) => <option key={l.id} value={l.name}>{l.name}</option>)}</optgroup>}
      {sp.length > 0 && <optgroup label="Поставщики/заказчики">{sp.map((s2: any) => <option key={s2.id} value={s2.name}>{s2.name}</option>)}</optgroup>}
      {cl.length > 0 && <optgroup label="Клиенты">{cl.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}</optgroup>}
      {br.length > 0 && <optgroup label="Филиалы">{br.map((b: any) => <option key={b.id} value={b.name}>{b.name}</option>)}</optgroup>}
    </select>
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

function CardDetailModal({ order, onClose, onAction, suppliers, toast, settings, myId }: {
  order: Order; onClose: () => void
  onAction: (id: string, action: string, payload?: Record<string, unknown>) => Promise<void>
  suppliers: { id: string; name: string }[]; toast: (m: string) => void
  settings: SettingsData | null
  myId: string
}) {
  const [history, setHistory] = useState<any[]>([])
  const [tab, setTab] = useState<'positions' | 'history' | 'chat' | null>(null)
  const [msgCount, setMsgCount] = useState(0)
  const [editPos, setEditPos] = useState<string | null>(null)
  const [priceEdit, setPriceEdit] = useState<{ qty: string; price: string }>({ qty: '', price: '' })
  // Правка цены/кол-ва позиций на экранах К учёту (accounting) и Бухгалтерии
  // (bookkeeping). Реюз действия updatePosDetail. Гейт только по экрану:
  // AdminApp — админская оболочка (super_admin/bookkeeper), порталы branch/
  // logist/client её не рендерят; ролью не режем, т.к. у старых JWT role
  // может быть пустой (getSession не подтягивает роль из БД) — это и мешало
  // редактированию. Философия владельца: никаких блокировок.
  const canEditMoney = order.screen === 'accounting' || order.screen === 'bookkeeping'
  function startMoneyEdit(p: any) { setEditPos(p.id); setPriceEdit({ qty: String(p.qty ?? ''), price: String(p.price ?? '') }) }
  async function saveMoneyEdit(posId: string) {
    await onAction(order.id, 'updatePosDetail', { posId, qty: Number(priceEdit.qty) || 0, price: Number(priceEdit.price) || 0 })
    setEditPos(null)
  }
  const [addPos, setAddPos] = useState(false)
  const [newPos, setNewPos] = useState({ name1c: '', oral: '', qty: '', unit: 'шт', price: '', resp: '', supplier: '', supplierId: '', status: 'В работе' })
  const pct = cardProgress(order)
  const sum = cardSum(order)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchHistory(order.id).then((h: any) => setHistory(h)).catch(() => {})
    // счётчик сообщений чата для бейджа вкладки
    fetch(`/api/orders/${order.id}/messages`).then(r => r.ok ? r.json() : []).then((d: any) => setMsgCount(Array.isArray(d) ? d.length : 0)).catch(() => {})
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
                <Btn size="sm" onClick={() => handleStatusChange(order.id, 'returnToReception')}>← На стол приёмки</Btn>
              </>
            )}
            {order.screen === 'incoming' && order.toacc && (
              <Btn variant="primary" size="sm" onClick={() => handleStatusChange(order.id, 'sendAcc')}>→ К учёту</Btn>
            )}
            {order.screen === 'accounting' && (
              <>
                <Btn variant="primary" size="sm" onClick={() => handleStatusChange(order.id, 'postAcc')}>→ Бухгалтерия</Btn>
                <Btn size="sm" onClick={() => handleStatusChange(order.id, 'postpone')}>{order.postponed ? 'Снять откл.' : 'Отложить'}</Btn>
                <Btn size="sm" onClick={() => handleStatusChange(order.id, 'returnToIncoming')}>← Вернуть</Btn>
              </>
            )}
            {order.screen === 'bookkeeping' && (
              <>
                <Btn size="sm" onClick={() => handleStatusChange(order.id, 'returnToAcc')}>← К учёту</Btn>
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
              <Btn size="sm" onClick={() => handleStatusChange(order.id, 'unarchive')}>↺ Вернуть из архива</Btn>
            )}
          </div>

          {/* Вкладки */}
          <div style={{ display: 'flex', gap: 4, marginBottom: tab ? 14 : 0 }}>
            {(['positions', 'history', 'chat'] as const).map(t => (
              <button key={t} onClick={() => setTab(prev => prev === t ? null : t)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: tab === t ? COLORS.primary : '#f1efec', color: tab === t ? '#fff' : '#8a847c' }}>
                {t === 'positions' ? `Позиции (${order.positions.length})` : t === 'history' ? 'История' : `💬 Чат${msgCount > 0 ? ` (${msgCount})` : ''}`}
                {tab === t ? ' ▲' : ' ▼'}
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
              {/* Таблица позиций по ТЗ: № | Название | статус | кол-во | (цены только в бухгалтерии) */}
              {order.positions.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8f6f3' }}>
                      <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#8a847c', textAlign: 'left' }}>№</th>
                      <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#8a847c', textAlign: 'left' }}>НАИМЕНОВАНИЕ</th>
                      <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#8a847c', textAlign: 'right' }}>КОЛ-ВО</th>
                      <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#8a847c', textAlign: 'left' }}>СТАТУС</th>
                      {canEditMoney && <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#8a847c', textAlign: 'right' }}>ЦЕНА</th>}
                      {order.screen === 'bookkeeping' && <th style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#8a847c', textAlign: 'right' }}>СУММА</th>}
                      {canEditMoney && <th style={{ padding: '7px 10px' }} />}
                    </tr>
                  </thead>
                  <tbody>
                    {order.positions.map((p, i) => {
                      const editing = canEditMoney && editPos === p.id
                      const moneyInp: React.CSSProperties = { width: 74, padding: '4px 6px', borderRadius: 6, border: '1.5px solid #e6e2dc', fontSize: 12, textAlign: 'right', fontFamily: 'inherit' }
                      return (
                      <tr key={p.id} style={{ borderTop: '1px solid #f1efec' }}>
                        <td style={{ padding: '8px 10px', fontSize: 12, color: '#8a847c' }}>{i + 1}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name1c || p.oral || '—'}</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#a39c92' }}>{p.id}</div>
                          {p.oral && p.name1c && <div style={{ fontSize: 11, color: '#8a847c' }}>{p.oral}</div>}
                          {p.resp && <div style={{ fontSize: 11, color: '#8a847c' }}>Логист: {p.resp}</div>}
                          {p.supplier && <div style={{ fontSize: 11, color: '#8a847c' }}>Поставщик: {p.supplier}</div>}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 500, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {editing
                            ? <input type="number" inputMode="decimal" value={priceEdit.qty} onChange={e => setPriceEdit(v => ({ ...v, qty: e.target.value }))} style={moneyInp} />
                            : (p.qty > 0 ? `${p.qty} ${p.unit}` : <span style={{ color: '#8a847c' }}>—</span>)}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <StatusBadge status={p.status} />
                          {p.late && <span style={{ fontSize: 10, background: '#faeaea', color: '#b03020', padding: '1px 5px', borderRadius: 20, fontWeight: 600, marginLeft: 4 }}>!</span>}
                        </td>
                        {canEditMoney && (
                          <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {editing
                              ? <input type="number" inputMode="decimal" value={priceEdit.price} onChange={e => setPriceEdit(v => ({ ...v, price: e.target.value }))} style={moneyInp} />
                              : (p.price > 0 ? fmtMoney(p.price) : <span style={{ color: '#8a847c' }}>—</span>)}
                          </td>
                        )}
                        {order.screen === 'bookkeeping' && (
                          <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: COLORS.primary }}>
                            {p.price > 0 ? fmtMoney(p.qty * p.price) : '—'}
                          </td>
                        )}
                        {canEditMoney && (
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                            {editing ? (
                              <span style={{ display: 'inline-flex', gap: 4 }}>
                                <button onClick={() => saveMoneyEdit(p.id)} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: COLORS.primary, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>✓</button>
                                <button onClick={() => setEditPos(null)} style={{ padding: '4px 8px', borderRadius: 6, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#8a847c' }}>×</button>
                              </span>
                            ) : (
                              <button onClick={() => startMoneyEdit(p)} style={{ padding: '4px 8px', borderRadius: 6, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#8a847c' }}>✎ цена</button>
                            )}
                          </td>
                        )}
                      </tr>
                    )})}
                  </tbody>
                </table>
              )}

              {/* Сумма — только в бухгалтерии */}
              {order.screen === 'bookkeeping' && sum > 0 && (
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
                    {/* НАИМ. 1С — поиск по номенклатуре */}
                    <div>
                      <label style={LBL}>НАИМ. 1С</label>
                      <NomSearch
                        value={newPos.name1c}
                        onChange={(name, unit) => setNewPos(prev => ({ ...prev, name1c: name, ...(unit && !prev.unit ? { unit } : {}) }))}
                        placeholder="Поиск по номенклатуре..."
                      />
                    </div>
                    {[
                      { f: 'oral', l: 'УСТНОЕ НАЗВАНИЕ' },
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
                      <select style={INP} value={newPos.supplier} onChange={e => {
                        const sup = suppliers.find(s => s.name === e.target.value)
                        setNewPos(prev => ({ ...prev, supplier: e.target.value, supplierId: sup?.id || '' }))
                      }}>
                        <option value="">—</option>
                        <optgroup label="Поставщики">{suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</optgroup>
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

          {/* Чат */}
          {tab === 'chat' && (
            <CardChat cardId={order.id} myId={myId} height={340} onCount={setMsgCount} />
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
  const [outgoingTab, setOutgoingTab] = useState<'inwork' | 'ready' | 'all'>('inwork')
  const [sideOpen, setSideOpen] = useState(false)

  // Поиск/фильтр
  const [search, setSearch] = useState('')

  // Модалки создания
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [showCreateSpec, setShowCreateSpec] = useState(false)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showUserResult, setShowUserResult] = useState<{ user: any; accessUrl: string } | null>(null)
  const [showSpecAnalysis, setShowSpecAnalysis] = useState<{ sp: SpecProject; analysis: AnalysisRow[] } | null>(null)

  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([])
  const [reportsError, setReportsError] = useState(false)
  const [reportFilter, setReportFilter] = useState<'active' | 'done' | 'archive'>('active')
  const [reportDateFrom, setReportDateFrom] = useState('')
  const [reportDateTo, setReportDateTo] = useState('')

  // Склад
  const [stock, setStock] = useState<any[]>([])
  const [stockMovements, setStockMovements] = useState<any[]>([])

  // ── Приёмка: стейт формы создания ──
  const [recFormOpen, setRecFormOpen] = useState(false)
  const [recTo, setRecTo] = useState('')
  const [recProject, setRecProject] = useState('')
  const [recSpec, setRecSpec] = useState('')
  const [recContact, setRecContact] = useState('')
  const [recPhone, setRecPhone] = useState('')
  const [recDeadline, setRecDeadline] = useState('')  // дефолт ставится сегодня при ОТКРЫТИИ формы
  const [recComment, setRecComment] = useState('')
  const [recPositions, setRecPositions] = useState([
    { name1c: '', oral: '', qty: '', unit: 'шт', price: '', resp: '', supplierId: '', supplier: '', deadline: '', payment: '' }
  ])
  const [recShowPayment, setRecShowPayment] = useState<number[]>([])
  const [editingPositions, setEditingPositions] = useState<Record<string, any>>({})

  function recAddPos() {
    setRecPositions(p => [...p, { name1c: '', oral: '', qty: '', unit: 'шт', price: '', resp: '', supplierId: '', supplier: '', deadline: todayLocal(), payment: '' }])
  }
  function recUpdatePos(i: number, field: string, val: string) {
    setRecPositions(p => p.map((x, idx) => idx === i ? { ...x, [field]: val } : x))
  }
  function recRemovePos(i: number) {
    setRecPositions(p => p.filter((_, idx) => idx !== i))
  }
  function recTogglePayment(i: number) {
    setRecShowPayment(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])
  }
  function startEditPos(pos: any) {
    setEditingPositions(p => ({
      ...p,
      [pos.id]: { name1c: pos.name1c, oral: pos.oral, qty: pos.qty, unit: pos.unit, price: pos.price, resp: pos.resp, supplier: pos.supplier, supplierId: pos.supplierId || '', payment: pos.payment, deadline: pos.deadline ? pos.deadline.slice(0, 10) : '' }
    }))
  }
  async function saveEditingPosition(cardId: string, posId: string) {
    const data = editingPositions[posId]
    if (!data) return
    await handleAction(cardId, 'updatePosDetail', { posId, ...data, qty: Number(data.qty), price: Number(data.price) })
    setEditingPositions(p => { const n = { ...p }; delete n[posId]; return n })
  }
  async function handleRecSubmit(isDraft: boolean) {
    try {
      const positions = recPositions.filter(p => p.name1c || p.oral).map(p => ({
        name1c: p.name1c, oral: p.oral, qty: Number(p.qty) || 0, unit: p.unit,
        price: Number(p.price) || 0, resp: p.resp, supplier: p.supplier,
        supplierId: p.supplierId || undefined, status: 'В работе',
        deadline: p.deadline || undefined, payment: p.payment,
      }))
      // Отправка сразу в «Исходящие» (не черновик) требует комплектности:
      // получатель назначен и логист у каждой позиции. Черновик — без ограничений.
      if (!isDraft) {
        if (!recTo || !recTo.trim()) { showToast('Укажите получателя (Кому)'); return }
        if (positions.some(p => !(p.resp || '').trim())) { showToast('Назначьте логиста всем позициям'); return }
      }
      // «От кого» не спрашиваем: источник = создатель (админ). Клиент, для которого
      // собирается заказ, берётся из «К кому»: если это пользователь-клиент — его id
      // идёт в fromId (привязка к кабинету) и contactId (уведомления). Явно выбранный
      // контакт (суб-пользователь) переопределяет contactId.
      const toUser = settings?.users.find(u => u.name === recTo)
      const clientId = toUser && ['client', 'supplier_client', 'branch'].includes(toUser.role) ? toUser.id : undefined
      await createOrder({
        from: user.name, fromId: clientId,
        to: recTo, phone: recPhone, deadline: recDeadline || undefined,
        comment: recComment, projectId: recProject || undefined,
        specProjectId: recSpec || undefined, contactId: recContact || clientId || undefined,
        source: 'admin_manual', isDraft,
        screen: isDraft ? 'incoming' : 'outgoing',
        positions,
      })
      setRecFormOpen(false)
      setRecTo(''); setRecProject(''); setRecSpec('')
      setRecContact(''); setRecPhone(''); setRecDeadline(''); setRecComment('')
      setRecPositions([{ name1c: '', oral: '', qty: '', unit: 'шт', price: '', resp: '', supplierId: '', supplier: '', deadline: '', payment: '' }])
      setRecShowPayment([])
      loadOrders()
      showToast(isDraft ? 'Черновик сохранён' : 'Заказ создан и отправлен в исходящие')
    } catch (e: any) { showToast(e.message) }
  }

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

  // Отчёты логистов: ошибка загрузки НЕ должна выглядеть как «Нет отчётов».
  const loadDailyReports = useCallback(async () => {
    try { setDailyReports(await fetchDailyReports() as DailyReport[]); setReportsError(false) }
    catch { setReportsError(true) }
  }, [])

  // Realtime: канал 'orders' обновляет карточки + уведомления + дашборд.
  const loadLive = useCallback(() => { loadOrders(); loadNotifs(); loadDashboard() }, [loadOrders, loadNotifs, loadDashboard])
  useLiveData('orders', loadLive, [])

  // Настройки (пользователи/проекты/спецпроекты/поставщики) — канал 'settings':
  // загрузка при монтировании + при мутациях справочников/пользователей.
  useLiveData('settings', loadSettings, [])

  // Realtime 'reports' — только когда открыт экран бухгалтерии
  const screenRef = useRef(screen)
  screenRef.current = screen
  const loadReports = useCallback(() => {
    if (screenRef.current === 'bookkeeping') loadDailyReports()
  }, [])
  useLiveData('reports', loadReports, [])

  useEffect(() => {
    if (screen === 'warehouse') { fetchStock().then(s => setStock(s as any[])).catch(() => {}); fetchStockMovements().then(m => setStockMovements(m as any[])).catch(() => {}) }
    if (screen === 'bookkeeping') { loadDailyReports() }
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
    nomenclature: 0,
    settings: 0,
  }

  // ─── Навигация ────────────────────────────────────────────────────────────

  const NAV: Array<{ key: string; label: string; icon: string }> = [
    { key: 'dashboard', label: 'Дашборд', icon: '📊' },
    { key: 'incoming', label: 'Входящие', icon: '📥' },
    { key: 'reception', label: 'Приёмка', icon: '🔄' },
    { key: 'outgoing', label: 'Исходящие', icon: '📤' },
    { key: 'filter', label: 'Фильтр', icon: '🔍' },
    { key: 'accounting', label: 'К учёту', icon: '📋' },
    { key: 'warehouse', label: 'Склад', icon: '🏭' },
    { key: 'bookkeeping', label: 'Бухгалтерия', icon: '📒' },
    { key: 'archive', label: 'Архив', icon: '🗂' },
    { key: 'nomenclature', label: 'Номенклатура', icon: '📦' },
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
        // Входящие НЕ включают карточки из приёмки (reception) и черновики из приёмки
        const incActive = orders.filter(o => o.screen === 'incoming' && !o.isDraft && !o.isCancelled && !o.toacc)
        const incChanged = orders.filter(o => o.screen === 'incoming' && o.isChanged && !o.isCancelled)
        const incToacc = orders.filter(o => o.screen === 'incoming' && o.toacc && !o.isCancelled)
        const incDrafts = orders.filter(o => o.screen === 'incoming' && o.isDraft)
        const incCancelled = orders.filter(o => o.screen === 'incoming' && o.isCancelled)
        const incTabMap: Record<IncTab, Order[]> = { new: incActive, changed: incChanged, toacc: incToacc, drafts: incDrafts, cancelled: incCancelled }
        const incTabLabels: Record<IncTab, string> = {
          new: `Новые (${incActive.length})`,
          changed: `Изменения (${incChanged.length})`,
          toacc: `К учёту (${incToacc.length})`,
          drafts: `Черновики (${incDrafts.length})`,
          cancelled: `Отменённые (${incCancelled.length})`,
        }
        return (
          <div className="anim-fade">
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>Входящие</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {(Object.keys(incTabLabels) as IncTab[]).map(t => (
                <button key={t} onClick={() => setIncTab(t)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: incTab === t ? COLORS.primary : '#fff', color: incTab === t ? '#fff' : '#8a847c', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                  {incTabLabels[t]}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {incTabMap[incTab].length === 0
                ? <div style={{ textAlign: 'center', padding: 40, color: '#8a847c', fontSize: 14 }}>
                    {search ? 'Ничего не найдено' : 'Нет карточек'}
                  </div>
                : filterOrders(incTabMap[incTab]).map(o => {
                    const pct = cardProgress(o)
                    return (
                      <div key={o.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                        {/* Строка 1: мета */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 12, color: COLORS.primary }}>{o.id}</span>
                          <StatusBadge status={o.status} />
                          <SourceBadge source={o.source} />
                          {o.isChanged && <span style={{ fontSize: 10, background: '#fff0ea', color: '#c0532a', padding: '1px 7px', borderRadius: 20, fontWeight: 600 }}>⚡ ИЗМЕНЕНО</span>}
                          {o.postponed && <span style={{ fontSize: 10, background: '#eef2ff', color: '#4a5aaa', padding: '1px 7px', borderRadius: 20, fontWeight: 600 }}>ОТЛОЖЕН</span>}
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8a847c' }}>{fmtDate(o.createdAt)}</span>
                          <button onClick={() => { navigator.clipboard.writeText(o.trackingLink); showToast('Ссылка скопирована!') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>📎</button>
                          <Btn size="sm" onClick={() => setSelectedOrder(o)}>Открыть</Btn>
                        </div>
                        {/* Строка 2: маршрут */}
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                          {o.from} {o.to ? `→ ${o.to}` : ''}
                        </div>
                        {/* Строка 3: превью комментария */}
                        {o.comment && (
                          <div style={{ fontSize: 12, color: '#8a847c', marginBottom: 8, lineHeight: 1.5 }}>
                            {o.comment.slice(0, 100)}{o.comment.length > 100 ? '...' : ''}
                          </div>
                        )}
                        {/* Блок изменения */}
                        {o.isChanged && (
                          <div style={{ background: '#fff8e1', borderRadius: 8, padding: '8px 12px', marginBottom: 10, border: '1.5px solid #f5e4a0' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#8a6f00', marginBottom: 2 }}>Изменение от клиента:</div>
                            <div style={{ fontSize: 13 }}>{o.changeText}</div>
                            {o.changePhone && <div style={{ fontSize: 12, color: '#8a847c', marginTop: 2 }}>📞 {o.changePhone}</div>}
                          </div>
                        )}
                        {/* Прогресс если есть позиции */}
                        {o.positions.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <ProgressBar pct={pct} />
                            <div style={{ fontSize: 11, color: '#8a847c', marginTop: 3 }}>{o.positions.length} позиций · {fmtMoney(cardSum(o))}</div>
                          </div>
                        )}
                        {/* Кнопки по вкладке */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1efec', flexWrap: 'wrap' }}>
                          {incTab === 'new' && (
                            <>
                              <Btn size="sm" onClick={() => handleAction(o.id, 'postpone')}>{o.postponed ? 'Снять откл.' : 'Отложить'}</Btn>
                              <Btn size="sm" variant="danger" onClick={() => handleAction(o.id, 'cancel')}>Отменить</Btn>
                              <Btn size="sm" variant="primary" onClick={() => handleAction(o.id, 'accept')}>ПРИНЯТЬ →</Btn>
                            </>
                          )}
                          {incTab === 'changed' && (
                            <>
                              <Btn size="sm" variant="danger" onClick={() => handleAction(o.id, 'confirmChg')}>Отклонить</Btn>
                              <Btn size="sm" variant="primary" onClick={() => handleAction(o.id, 'confirmChg')}>✓ Принять изменение</Btn>
                            </>
                          )}
                          {incTab === 'toacc' && (
                            <>
                              <Btn size="sm" onClick={() => handleAction(o.id, 'reopenOutgoing')}>← В Исходящие</Btn>
                              <Btn size="sm" variant="primary" onClick={() => handleAction(o.id, 'sendAcc')}>Отправить в К Учёту →</Btn>
                            </>
                          )}
                          {incTab === 'drafts' && (
                            <>
                              <Btn size="sm" onClick={() => setSelectedOrder(o)}>Доработать</Btn>
                              <Btn size="sm" variant="primary" onClick={() => handleAction(o.id, 'accept')}>Отправить</Btn>
                            </>
                          )}
                          {incTab === 'cancelled' && (
                            <>
                              {o.cancelReason && <span style={{ fontSize: 12, color: '#8a847c' }}>Причина: {o.cancelReason}</span>}
                              <Btn size="sm" onClick={() => handleAction(o.id, 'restore')}>↺ Восстановить</Btn>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })
              }
            </div>
          </div>
        )
      }

      // ─── ПРИЁМКА ─────────────────────────────────────────────────────────
      case 'reception': {
        const waiting = reception.filter(o => o.block === 'waiting')
        const processing = reception.filter(o => o.block === 'processing')
        const recDrafts = orders.filter(o => o.isDraft)
        const recChanged = orders.filter(o => o.isChanged && !o.isCancelled)
        const clients = settings?.users.filter(u => ['client', 'supplier_client', 'logist'].includes(u.role)) || []
        const logists = settings?.users.filter(u => u.role === 'logist') || []
        const activeProjects = settings?.projects.filter(p => p.status === 'active') || []
        const activeSpecs = settings?.specProjects.filter(s => s.status === 'active') || []
        const suppliersList = settings?.suppliers || []

        // Контакты (суб-пользователи выбранного клиента) — теперь зависят от «К кому»
        const selectedClient = settings?.users.find(u => u.name === recTo)
        const subUsers = selectedClient ? (settings?.users.filter(u => u.companyId === selectedClient.id) || []) : []

        const inpSm: React.CSSProperties = { padding: '7px 10px', borderRadius: 6, fontSize: 12, border: '1.5px solid #e6e2dc', background: '#fff', outline: 'none', fontFamily: 'inherit', width: '100%' }
        const selSm: React.CSSProperties = { ...inpSm, cursor: 'pointer' }

        return (
          <div className="anim-fade">

            {/* ── Блок 0: Шапка счётчики ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 20 }}>Приёмка</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'В ожидании', val: waiting.length, bg: '#fff0ea', color: '#c0532a' },
                  { label: 'К приёму', val: processing.length, bg: '#fdf8e1', color: '#8a6f00' },
                  { label: 'Изменено', val: recChanged.length, bg: '#faeaea', color: '#b03020' },
                  { label: 'Черновики', val: recDrafts.length, bg: '#efece8', color: '#6b655b' },
                ].map(({ label, val, bg, color }) => (
                  <div key={label} style={{ background: bg, color, borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>
                    {label} {val}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Блок 1: Форма создания ── */}
            <div style={{ background: '#fff', borderRadius: 14, marginBottom: 20, boxShadow: '0 0 0 1.5px #e6e2dc', overflow: 'hidden' }}>
              <div
                onClick={() => {
                  // Дефолт «Срок» = сегодня в момент ОТКРЫТИЯ формы (не при монтировании),
                  // только для пустых полей — введённое пользователем не трогаем.
                  if (!recFormOpen) {
                    const t = todayLocal()
                    setRecDeadline(d => d || t)
                    setRecPositions(ps => ps.map(p => ({ ...p, deadline: p.deadline || t })))
                  }
                  setRecFormOpen(p => !p)
                }}
                style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: recFormOpen ? '1px solid #f1efec' : 'none' }}
              >
                <span style={{ fontWeight: 700, fontSize: 15 }}>＋ Создать новый заказ</span>
                <span style={{ fontSize: 18, color: '#8a847c', transform: recFormOpen ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }}>＋</span>
              </div>

              {recFormOpen && (
                <div style={{ padding: 20 }}>
                  {/* Основные поля */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={LBL}>К КОМУ (КЛИЕНТ) *</label>
                      <UnifiedSelect value={recTo} onChange={v => { setRecTo(v); setRecContact('') }} placeholder="— выберите клиента —" settings={settings} />
                    </div>
                    {subUsers.length > 0 && (
                      <div>
                        <label style={LBL}>КОНТАКТ</label>
                        <select style={INP} value={recContact} onChange={e => setRecContact(e.target.value)}>
                          <option value="">—</option>
                          {subUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label style={LBL}>ПРОЕКТ</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select style={{ ...INP, flex: 1 }} value={recProject} onChange={e => setRecProject(e.target.value)}>
                          <option value="">—</option>
                          {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button onClick={() => setShowCreateProject(true)} style={{ padding: '0 10px', borderRadius: 7, border: '1.5px solid #e6e2dc', background: '#f1efec', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>＋</button>
                      </div>
                    </div>
                    <div>
                      <label style={LBL}>СПЕЦПРОЕКТ</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select style={{ ...INP, flex: 1 }} value={recSpec} onChange={e => setRecSpec(e.target.value)}>
                          <option value="">—</option>
                          {activeSpecs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button onClick={() => setShowCreateSpec(true)} style={{ padding: '0 10px', borderRadius: 7, border: '1.5px solid #e6e2dc', background: '#f1efec', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>＋</button>
                      </div>
                    </div>
                    <div>
                      <label style={LBL}>ТЕЛЕФОН</label>
                      <input style={INP} value={recPhone} onChange={e => setRecPhone(e.target.value)} placeholder="+7 700 000 00 00" />
                    </div>
                    <div>
                      <label style={LBL}>СРОК</label>
                      <input style={INP} type="date" value={recDeadline} onChange={e => setRecDeadline(e.target.value)} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={LBL}>КОММЕНТАРИЙ</label>
                      <textarea style={{ ...INP, minHeight: 60, resize: 'vertical' }} value={recComment} onChange={e => setRecComment(e.target.value)} placeholder="Дополнительные пожелания..." />
                    </div>
                  </div>

                  {/* Таблица позиций */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#8a847c', marginBottom: 8, letterSpacing: '.04em' }}>ПОЗИЦИИ</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                        <thead>
                          <tr style={{ background: '#f1efec' }}>
                            {['НАИМЕНОВАНИЕ', 'КОЛ-ВО', 'ЕД.', 'ЦЕНА (ТГ)', 'ЛОГИСТ', 'ПОСТАВЩИК', 'СРОК', 'ОПЛАТА', ''].map(h => (
                              <th key={h} style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#8a847c', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {recPositions.map((pos, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f1efec' }}>
                              <td style={{ padding: '6px 4px' }}>
                                <NomSearch
                                  value={pos.name1c}
                                  onChange={(name, unit) => {
                                    recUpdatePos(i, 'name1c', name)
                                    if (unit && !pos.unit) recUpdatePos(i, 'unit', unit)
                                  }}
                                  placeholder="Поиск 1С..."
                                  style={{ fontSize: 12, padding: '6px 8px' }}
                                />
                              </td>
                              <td style={{ padding: '6px 4px', width: 70 }}>
                                <input style={inpSm} type="number" inputMode="decimal" value={pos.qty || ''} onChange={e => recUpdatePos(i, 'qty', e.target.value)} placeholder="0" />
                              </td>
                              <td style={{ padding: '6px 4px', width: 60 }}>
                                <input style={inpSm} value={pos.unit} onChange={e => recUpdatePos(i, 'unit', e.target.value)} placeholder="шт" />
                              </td>
                              <td style={{ padding: '6px 4px', width: 100 }}>
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                  <input style={inpSm} type="number" inputMode="decimal" value={pos.price || ''} onChange={e => recUpdatePos(i, 'price', e.target.value)} placeholder="0" />
                                  <button
                                    title="Оплата"
                                    onClick={() => recTogglePayment(i)}
                                    style={{ padding: '5px 7px', borderRadius: 6, border: `1.5px solid ${recShowPayment.includes(i) ? COLORS.primary : '#e6e2dc'}`, background: recShowPayment.includes(i) ? '#fff8f5' : '#fff', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}
                                  >💳</button>
                                </div>
                                {recShowPayment.includes(i) && (
                                  <select style={{ ...inpSm, marginTop: 4 }} value={pos.payment} onChange={e => recUpdatePos(i, 'payment', e.target.value)}>
                                    <option value="">— оплата —</option>
                                    <option value="Оплачено">Оплачено</option>
                                    <option value="Не оплачено">Не оплачено</option>
                                    <option value="Частично">Частично</option>
                                  </select>
                                )}
                              </td>
                              <td style={{ padding: '6px 4px' }}>
                                <UnifiedSelect value={pos.resp} onChange={v => recUpdatePos(i, 'resp', v)} placeholder="—" style={selSm} settings={settings} roles={['logist']} />
                              </td>
                              <td style={{ padding: '6px 4px' }}>
                                <UnifiedSelect value={pos.supplier} onChange={v => {
                                  const sup2 = suppliersList.find(s => s.name === v)
                                  recUpdatePos(i, 'supplier', v)
                                  recUpdatePos(i, 'supplierId', sup2?.id || '')
                                }} placeholder="—" style={selSm} settings={settings} />
                              </td>
                              <td style={{ padding: '6px 4px', width: 110 }}>
                                <input style={inpSm} type="date" value={pos.deadline} onChange={e => recUpdatePos(i, 'deadline', e.target.value)} />
                              </td>
                              <td style={{ padding: '6px 4px', width: 110 }}>
                                <select style={selSm} value={pos.payment} onChange={e => recUpdatePos(i, 'payment', e.target.value)}>
                                  <option value="">—</option>
                                  <option value="Оплачено">Оплачено</option>
                                  <option value="Не оплачено">Не оплачено</option>
                                  <option value="Частично">Частично</option>
                                </select>
                              </td>
                              <td style={{ padding: '6px 4px', width: 64 }}>
                                <div style={{ display: 'flex', gap: 2 }}>
                                  <button onClick={() => setRecPositions(p => { const copy = { ...p[i] }; const arr = [...p]; arr.splice(i + 1, 0, copy); return arr })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a847c', fontSize: 15, padding: '2px 4px' }} title="Клонировать">📋</button>
                                  <button onClick={() => recRemovePos(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b03020', fontSize: 15, padding: '2px 4px' }} title="Удалить">🗑</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button onClick={recAddPos} style={{ marginTop: 8, border: '1.5px dashed #d8d3cc', borderRadius: 7, padding: '6px 16px', background: 'none', cursor: 'pointer', fontSize: 12, color: '#8a847c', fontFamily: 'inherit' }}>
                      ＋ Добавить позицию
                    </button>
                  </div>

                  {/* Кнопки формы */}
                  <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid #f1efec' }}>
                    <Btn onClick={() => handleRecSubmit(true)}>Сохранить черновик</Btn>
                    <Btn variant="primary" onClick={() => handleRecSubmit(false)}>ОТПРАВИТЬ ЗАКАЗ →</Btn>
                    <Btn variant="ghost" onClick={() => setRecFormOpen(false)} style={{ marginLeft: 'auto', color: '#8a847c' }}>Отмена</Btn>
                  </div>
                </div>
              )}
            </div>

            {/* ── Блок 2: Стол приёмки (block=processing) ── */}
            {processing.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Стол приёмки
                  <span style={{ fontSize: 12, background: '#fdf8e1', color: '#8a6f00', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{processing.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {processing.map(order => (
                    <div key={order.id} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 0 0 1.5px #e6e2dc', overflow: 'hidden' }}>
                      {/* Шапка карточки */}
                      <div style={{ padding: '12px 16px', background: '#faf8f6', borderBottom: '1px solid #f1efec', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: COLORS.primary }}>{order.id}</span>
                        <StatusBadge status={order.status} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{order.from} →</span>
                        <UnifiedSelect
                          value={order.to || ''}
                          onChange={v => handleAction(order.id, 'updateOrder', { to: v })}
                          placeholder="К кому / куда"
                          style={{ fontSize: 12, padding: '4px 8px', minWidth: 140 }}
                          settings={settings}
                        />
                        {order.deadline && <span style={{ fontSize: 12, color: '#8a847c' }}>срок {fmtDate(order.deadline)}</span>}
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                          <Btn size="sm" onClick={() => handleAction(order.id, 'returnToIncoming')}>← Вернуть</Btn>
                          <Btn size="sm" variant="primary" onClick={async () => {
                            // 1. Сначала сохраняем все несохранённые изменения позиций
                            const drafts = Object.entries(editingPositions)
                            for (const [posId, ed] of drafts) {
                              const pos = order.positions.find(p => p.id === posId)
                              if (!pos) continue
                              await handleAction(order.id, 'updatePosDetail', {
                                posId,
                                name1c: ed.name1c ?? pos.name1c,
                                oral: pos.oral,
                                qty: Number(ed.qty ?? pos.qty) || 0,
                                unit: ed.unit ?? pos.unit,
                                price: Number(ed.price ?? pos.price) || 0,
                                resp: ed.resp ?? pos.resp,
                                supplier: ed.supplier ?? pos.supplier,
                                supplierId: ed.supplierId ?? pos.supplierId,
                                status: ed.status ?? pos.status,
                                payment: ed.payment ?? pos.payment,
                                deadline: ed.deadline ?? pos.deadline,
                                late: pos.late,
                              })
                            }
                            setEditingPositions({})
                            // 2. Проверяем name1c у всех позиций
                            const latest = orders.find(o => o.id === order.id)
                            const positions = latest?.positions || order.positions
                            const noName = positions.filter(p => {
                              const ed = editingPositions[p.id]
                              return !(ed?.name1c ?? p.name1c)
                            })
                            if (noName.length > 0) {
                              showToast(`⚠️ Заполните НАИМ. 1С у ${noName.length} позиций`)
                              return
                            }
                            // Комплектность: получатель назначен
                            if (!((latest?.to ?? order.to) || '').trim()) {
                              showToast('Укажите получателя (Кому)')
                              return
                            }
                            // Комплектность: логист у каждой позиции (с учётом черновиков редактора)
                            const noResp = positions.filter(p => {
                              const ed = editingPositions[p.id]
                              return !(((ed?.resp ?? p.resp) as string) || '').trim()
                            })
                            if (noResp.length > 0) {
                              showToast('Назначьте логиста всем позициям')
                              return
                            }
                            // 3. Отправляем в исходящие
                            handleAction(order.id, 'process')
                          }}>ОТПРАВИТЬ В ИСХОДЯЩИЕ →</Btn>
                        </div>
                      </div>

                      {/* Таблица позиций — редактирование */}
                      <div style={{ padding: '12px 16px', overflowX: 'auto' }}>
                        {order.positions.length === 0 && (
                          <div style={{ background: '#fff8e1', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#8a6f00', fontWeight: 500 }}>
                            💬 Со слов: {order.comment}
                          </div>
                        )}
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                          <thead>
                            <tr style={{ background: '#f1efec' }}>
                              {['СО СЛОВ', 'НАИМ. 1С', 'КОЛ-ВО', 'ЕД.', 'ЦЕНА', 'ЛОГИСТ', 'ПОСТАВЩИК', 'СРОК', 'ОПЛАТА', ''].map(h => (
                                <th key={h} style={{ padding: '7px 8px', fontSize: 10, fontWeight: 700, color: '#8a847c', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {order.positions.map(pos => {
                              const ed = editingPositions[pos.id] || {}
                              const isEditing = !!editingPositions[pos.id]
                              return (
                                <tr key={pos.id} style={{ borderBottom: '1px solid #f1efec', background: !(ed.name1c !== undefined ? ed.name1c : pos.name1c) ? '#fff5f0' : 'transparent', cursor: isEditing ? 'default' : 'pointer' }} onClick={() => !isEditing && startEditPos(pos)}>
                                  {/* СО СЛОВ — жёлтый readonly */}
                                  <td style={{ padding: '6px 8px' }}>
                                    <div style={{ background: '#fff8e1', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#8a6f00', minWidth: 80, cursor: 'default' }}>{pos.oral || '—'}</div>
                                  </td>
                                  {/* НАИМ 1С */}
                                  <td style={{ padding: '6px 4px' }}>
                                    {isEditing
                                      ? <NomSearch
                                          value={ed.name1c ?? pos.name1c}
                                          onChange={(name, unit) => {
                                            setEditingPositions(p => ({ ...p, [pos.id]: { ...p[pos.id], name1c: name, ...(unit ? { unit } : {}) } }))
                                          }}
                                          style={{ fontSize: 12, padding: '5px 8px', width: 160 }}
                                        />
                                      : <span style={{ fontSize: 12 }}>{pos.name1c || <span style={{ color: '#b8b1a6' }}>—</span>}</span>
                                    }
                                  </td>
                                  {/* КОЛ-ВО */}
                                  <td style={{ padding: '6px 4px', width: 70 }}>
                                    {isEditing
                                      ? <input style={{ ...INP, fontSize: 12, padding: '5px 8px', width: 60 }} type="number" inputMode="decimal" value={(ed.qty ?? pos.qty) || ''} onChange={e => setEditingPositions(p => ({ ...p, [pos.id]: { ...p[pos.id], qty: e.target.value } }))} />
                                      : <span style={{ fontSize: 12 }}>{pos.qty}</span>
                                    }
                                  </td>
                                  {/* ЕД. */}
                                  <td style={{ padding: '6px 4px', width: 50 }}>
                                    {isEditing
                                      ? <input style={{ ...INP, fontSize: 12, padding: '5px 8px', width: 44 }} value={ed.unit ?? pos.unit} onChange={e => setEditingPositions(p => ({ ...p, [pos.id]: { ...p[pos.id], unit: e.target.value } }))} />
                                      : <span style={{ fontSize: 12 }}>{pos.unit}</span>
                                    }
                                  </td>
                                  {/* ЦЕНА */}
                                  <td style={{ padding: '6px 4px', width: 90 }}>
                                    {isEditing
                                      ? <input style={{ ...INP, fontSize: 12, padding: '5px 8px', width: 80 }} type="number" inputMode="decimal" value={(ed.price ?? pos.price) || ''} onChange={e => setEditingPositions(p => ({ ...p, [pos.id]: { ...p[pos.id], price: e.target.value } }))} />
                                      : <span style={{ fontSize: 12 }}>{pos.price > 0 ? fmtMoney(pos.price) : <span style={{ color: '#b8b1a6' }}>—</span>}</span>
                                    }
                                  </td>
                                  {/* ЛОГИСТ */}
                                  <td style={{ padding: '6px 4px' }}>
                                    {isEditing
                                      ? <UnifiedSelect value={ed.resp ?? pos.resp} onChange={v => setEditingPositions(p => ({ ...p, [pos.id]: { ...p[pos.id], resp: v } }))} placeholder="—" style={{ fontSize: 12, padding: '5px 8px', width: 160 }} settings={settings} roles={['logist']} />
                                      : <span style={{ fontSize: 12 }}>{pos.resp || <span style={{ color: '#b8b1a6' }}>—</span>}</span>
                                    }
                                  </td>
                                  {/* ПОСТАВЩИК */}
                                  <td style={{ padding: '6px 4px' }}>
                                    {isEditing
                                      ? <UnifiedSelect value={ed.supplier ?? pos.supplier} onChange={v => {
                                          const sup2 = suppliersList.find(s => s.name === v)
                                          setEditingPositions(p => ({ ...p, [pos.id]: { ...p[pos.id], supplier: v, supplierId: sup2?.id || '' } }))
                                        }} placeholder="—" style={{ fontSize: 12, padding: '5px 8px', width: 160 }} settings={settings} />
                                      : <span style={{ fontSize: 12 }}>{pos.supplier || <span style={{ color: '#b8b1a6' }}>—</span>}</span>
                                    }
                                  </td>
                                  {/* СРОК */}
                                  <td style={{ padding: '6px 4px', width: 110 }}>
                                    {isEditing
                                      ? <input style={{ ...INP, fontSize: 12, padding: '5px 8px', width: 100 }} type="date" value={ed.deadline ?? (pos.deadline ? pos.deadline.slice(0, 10) : '')} onChange={e => setEditingPositions(p => ({ ...p, [pos.id]: { ...p[pos.id], deadline: e.target.value } }))} />
                                      : <span style={{ fontSize: 12 }}>{fmtDate(pos.deadline)}</span>
                                    }
                                  </td>
                                  {/* ОПЛАТА */}
                                  <td style={{ padding: '6px 4px', width: 110 }}>
                                    {isEditing
                                      ? <select style={{ ...INP, fontSize: 12, padding: '5px 8px', width: 100 }} value={ed.payment ?? pos.payment} onChange={e => setEditingPositions(p => ({ ...p, [pos.id]: { ...p[pos.id], payment: e.target.value } }))}>
                                          <option value="">—</option>
                                          <option value="Оплачено">Оплачено</option>
                                          <option value="Не оплачено">Не оплачено</option>
                                          <option value="Частично">Частично</option>
                                        </select>
                                      : <span style={{ fontSize: 12 }}>{pos.payment || <span style={{ color: '#b8b1a6' }}>—</span>}</span>
                                    }
                                  </td>
                                  {/* Действия */}
                                  <td style={{ padding: '6px 4px', width: 80 }}>
                                    {isEditing ? (
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={e => { e.stopPropagation(); saveEditingPosition(order.id, pos.id) }} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: COLORS.primary, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>✓</button>
                                        <button onClick={e => { e.stopPropagation(); setEditingPositions(p => { const n = { ...p }; delete n[pos.id]; return n }) }} style={{ padding: '4px 8px', borderRadius: 6, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontSize: 12 }}>✕</button>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(`${pos.name1c || pos.oral} ${pos.qty} ${pos.unit}`); showToast('Скопировано!') }} style={{ padding: '4px 7px', borderRadius: 6, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontSize: 12 }} title="Копировать текст">📋</button>
                                        <button onClick={async e => { e.stopPropagation(); await handleAction(order.id, 'addPos', { name1c: pos.name1c, oral: pos.oral, qty: pos.qty, unit: pos.unit, price: pos.price, resp: pos.resp, supplier: pos.supplier, supplierId: pos.supplierId, status: pos.status }); showToast('Позиция клонирована') }} style={{ padding: '4px 7px', borderRadius: 6, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontSize: 12 }} title="Клонировать позицию">🔁</button>
                                        <button onClick={e => { e.stopPropagation(); handleAction(order.id, 'deletePos', { posId: pos.id }) }} style={{ padding: '4px 7px', borderRadius: 6, border: '1.5px solid #faeaea', background: '#fff', cursor: 'pointer', fontSize: 12 }}>🗑</button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        {order.positions.length === 0 && (
                          <div style={{ marginTop: 8, color: '#8a847c', fontSize: 12, fontStyle: 'italic' }}>
                            Нажмите "Взять в обработку" чтобы распарсить комментарий в позиции
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Блок 3: Ожидание (block=waiting) ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                Ожидание
                <span style={{ fontSize: 12, background: '#fff0ea', color: '#c0532a', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{waiting.length}</span>
              </div>
              {waiting.length === 0
                ? <div style={{ color: '#8a847c', fontSize: 13, padding: '16px 0' }}>Нет карточек в ожидании</div>
                : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 12 }}>
                    {waiting.map(order => (
                      <div key={order.id} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                        {/* Шапка */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 12, color: COLORS.primary }}>{order.id}</span>
                          <SourceBadge source={order.source} />
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8a847c' }}>{fmtDate(order.createdAt)}</span>
                        </div>
                        {/* Маршрут */}
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{order.from} → {order.to || '—'}</div>
                        {/* Комментарий превью (3 строки) */}
                        {order.comment && (
                          <div style={{ fontSize: 12, color: '#8a847c', marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
                            {order.comment}
                          </div>
                        )}
                        {/* Кнопки */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Btn variant="primary" size="sm" style={{ flex: 1 }} onClick={() => handleAction(order.id, 'take')}>
                            ПРИНЯТЬ В ОБРАБОТКУ →
                          </Btn>
                          <Btn variant="danger" size="sm" onClick={() => handleAction(order.id, 'cancel')}>✕</Btn>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>

            {/* ── Блок 4: Черновики ── */}
            {recDrafts.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Черновики
                  <span style={{ fontSize: 12, background: '#efece8', color: '#6b655b', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{recDrafts.length}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                  {recDrafts.map(order => (
                    <div key={order.id} style={{ background: '#faf8f6', borderRadius: 12, padding: 16, border: '1.5px dashed #d8d3cc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 12, color: '#8a847c' }}>{order.id}</span>
                        <StatusBadge status="Черновик" />
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8a847c' }}>{fmtDate(order.createdAt)}</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{order.from}</div>
                      {order.comment && <div style={{ fontSize: 12, color: '#8a847c', marginBottom: 10 }}>{order.comment.slice(0, 60)}...</div>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn size="sm" onClick={() => { setSelectedOrder(order) }}>Доработать</Btn>
                        <Btn size="sm" variant="primary" onClick={() => handleAction(order.id, 'accept')}>Отправить</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )
      }

      // ─── ИСХОДЯЩИЕ ───────────────────────────────────────────────────────
      case 'outgoing': {
        const outInwork = outgoing.filter(o => cardProgress(o) < 60)
        const outReady = outgoing.filter(o => cardProgress(o) >= 60)
        type OutTab = 'inwork' | 'ready' | 'all'
        const outTabList: Array<[OutTab, string, Order[]]> = [
          ['inwork', `В работе (${outInwork.length})`, outInwork],
          ['ready', `Готово к доставке (${outReady.length})`, outReady],
          ['all', `Все (${outgoing.length})`, outgoing],
        ]
        const [outTab, setOutTab] = [outgoingTab, setOutgoingTab]
        const outList = outTabList.find(t => t[0] === outTab)?.[2] || outgoing

        return (
          <div className="anim-fade">
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>
              Исходящие <span style={{ fontSize: 14, color: '#8a847c', fontWeight: 400 }}>({outgoing.length})</span>
            </div>

            {/* Вкладки */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {outTabList.map(([key, label]) => (
                <button key={key} onClick={() => setOutgoingTab(key)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: outTab === key ? COLORS.primary : '#fff', color: outTab === key ? '#fff' : '#8a847c', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Список карточек */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {outList.length === 0
                ? <div style={{ textAlign: 'center', padding: 40, color: '#8a847c', fontSize: 14 }}>Нет карточек</div>
                : filterOrders(outList).map(o => {
                    const pct = cardProgress(o)
                    const overdue = isOverdue(o)
                    return (
                      <div key={o.id} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 0 0 1.5px #e6e2dc', overflow: 'hidden' }}>
                        {/* Шапка карточки */}
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1efec' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: COLORS.primary }}>{o.id}</span>
                            {overdue && <span style={{ fontSize: 11, background: '#faeaea', color: '#b03020', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>⚠ Просрочено</span>}
                            {pct >= 100 && <span style={{ fontSize: 11, background: '#e8f5ee', color: '#2e8a5e', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>✓ Готово</span>}
                            {pct < 100 && !overdue && <span style={{ fontSize: 11, background: '#fff0ea', color: '#c0532a', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>В работе</span>}
                            {o.isChanged && <span style={{ fontSize: 11, background: '#fdf8e1', color: '#8a6f00', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>⚡ Изменено клиентом</span>}
                            <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 16, color: barColor(pct) }}>{pct}%</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{o.from} → {o.to || '—'}</span>
                            {o.deadline && <span style={{ fontSize: 12, color: '#8a847c' }}>срок {fmtDate(o.deadline)}</span>}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <ProgressBar pct={pct} height={6} />
                          </div>
                        </div>

                        {/* Позиции */}
                        {o.positions.length > 0 && (
                          <div style={{ padding: '12px 18px', borderBottom: '1px solid #f1efec' }}>
                            {o.positions.map((pos, i) => {
                              const pPct = posPct(pos)
                              return (
                                <div key={pos.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: i < o.positions.length - 1 ? '1px solid #f8f6f3' : 'none' }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500 }}>{pos.name1c || pos.oral}</div>
                                    <div style={{ fontSize: 11, color: '#8a847c' }}>{pos.qty} {pos.unit}{pos.resp ? ` · ${pos.resp}` : ''}{pos.supplier ? ` · ${pos.supplier}` : ''}</div>
                                  </div>
                                  <div style={{ width: 120 }}>
                                    <ProgressBar pct={pPct} height={4} />
                                  </div>
                                  {pos.late && <span style={{ fontSize: 10, background: '#faeaea', color: '#b03020', padding: '1px 6px', borderRadius: 20, fontWeight: 600, flexShrink: 0 }}>ПРОСРОЧ.</span>}
                                  <select
                                    value={pos.status}
                                    onChange={e => handleAction(o.id, 'updatePos', { posId: pos.id, status: e.target.value })}
                                    onClick={e => e.stopPropagation()}
                                    style={{ padding: '4px 8px', borderRadius: 6, border: '1.5px solid #e6e2dc', background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                                  >
                                    {['В работе', 'Готово к отгрузке', 'В пути', 'Доставлено', 'Принято филиалом'].map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Футер */}
                        <div style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {cardSum(o) > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#26231f' }}>Сумма: {fmtMoney(cardSum(o))}</span>}
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                            <Btn size="sm" onClick={() => setSelectedOrder(o)}>Открыть</Btn>
                            <Btn size="sm" onClick={() => { navigator.clipboard.writeText(o.trackingLink); showToast('Ссылка скопирована!') }}>📎 Ссылка клиенту</Btn>
                            <Btn size="sm" onClick={() => handleAction(o.id, 'returnOut')}>← Вернуть</Btn>
                            <Btn size="sm" onClick={() => handleAction(o.id, 'returnToReception')}>← На стол приёмки</Btn>
                            <Btn size="sm" variant="primary" onClick={() => handleAction(o.id, 'markAll')}>✓ Всё выполнено</Btn>
                            {o.toacc && <Btn size="sm" variant="primary" onClick={() => handleAction(o.id, 'sendAcc')}>Отправить в К Учёту →</Btn>}
                          </div>
                        </div>
                      </div>
                    )
                  })
              }
            </div>
          </div>
        )
      }

      // ─── ФИЛЬТР (Канбан dnd-kit) ─────────────────────────────────────────
      case 'filter':
        return (
          <FilterScreen
            orders={orders}
            settings={settings}
            onOpen={(order) => setSelectedOrder(order)}
          />
        )

      // ─── К УЧЁТУ ─────────────────────────────────────────────────────────
      case 'accounting':
        return (
          <div className="anim-fade">
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>К учёту <span style={{ fontSize: 14, color: '#8a847c', fontWeight: 400 }}>({accounting.length})</span></div>
            {(() => {
              const filtered = filterOrders(accounting)
              if (filtered.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#8a847c', fontSize: 14 }}>Нет карточек к учёту</div>
              return filtered.map(o => (
                <div key={o.id}>
                  <OrderCard order={o} onClick={() => setSelectedOrder(o)} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: -4, marginBottom: 12, paddingRight: 4 }}>
                    <Btn size="sm" onClick={() => handleAction(o.id, 'postpone')}>{o.postponed ? 'Снять откл.' : 'Отложить'}</Btn>
                    <Btn size="sm" onClick={() => handleAction(o.id, 'returnToIncoming')}>← Вернуть</Btn>
                    <Btn size="sm" variant="primary" onClick={() => handleAction(o.id, 'postAcc')}>→ Бухгалтерия</Btn>
                  </div>
                </div>
              ))
            })()}
          </div>
        )

      // ─── СКЛАД ───────────────────────────────────────────────────────────
      case 'warehouse':
        return (
          <WarehouseScreen
            onOpenCard={(cardId) => {
              const order = orders.find(o => o.id === cardId)
              if (order) setSelectedOrder(order)
              else { setScreen('filter'); showToast(`Карточка ${cardId}`) }
            }}
          />
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
              {(['cards', 'reports', 'shifts'] as BookkeepingTab[]).map(t => (
                <button key={t} onClick={() => { setBookTab(t); if (t !== 'cards') loadDailyReports() }} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: bookTab === t ? COLORS.primary : '#fff', color: bookTab === t ? '#fff' : '#8a847c', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                  {t === 'cards' ? `Карточки (${bookkeeping.length})` : t === 'reports' ? 'Отчёты логистов' : 'Смены'}
                </button>
              ))}
            </div>
            {bookTab === 'cards' && (() => {
                const filtered = filterOrders(bookkeeping)
                if (filtered.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#8a847c', fontSize: 14 }}>Нет карточек</div>
                return filtered.map(o => (
                  <div key={o.id}>
                    <OrderCard order={o} onClick={() => setSelectedOrder(o)} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: -4, marginBottom: 12, paddingRight: 4 }}>
                      <Btn size="sm" onClick={() => handleAction(o.id, 'returnToAcc')}>← К учёту</Btn>
                      {!o.invoice && <Btn size="sm" onClick={() => handleAction(o.id, 'createDoc', { type: 'invoice' })}>↓ Счёт</Btn>}
                      {!o.fact && <Btn size="sm" onClick={() => handleAction(o.id, 'createDoc', { type: 'fact' })}>↓ Счёт-фактура</Btn>}
                      {!o.posted1C && <Btn size="sm" onClick={() => handleAction(o.id, 'post1C')}>Провести 1С</Btn>}
                      <Btn size="sm" variant="primary" disabled={!o.posted1C} onClick={() => o.posted1C && handleAction(o.id, 'sendArchive')}>→ Архив</Btn>
                    </div>
                  </div>
                ))
              })()}
            {bookTab === 'reports' && (() => {
              // Фильтрация отчётов
              const filtered = dailyReports.filter(r => {
                // «Новые» показывают и отправленные (processing), и незакрытые смены логистов (draft)
                if (reportFilter === 'active' && r.status !== 'processing' && r.status !== 'draft') return false
                if (reportFilter === 'done' && r.status !== 'done') return false
                if (reportFilter === 'archive' && r.status !== 'archive') return false
                if (reportDateFrom && new Date(r.date) < new Date(reportDateFrom)) return false
                if (reportDateTo && new Date(r.date) > new Date(reportDateTo + 'T23:59:59')) return false
                return true
              })

              return (
                <div>
                  {/* Фильтры */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    {([['active', 'Новые'], ['done', 'Принятые'], ['archive', 'Архив']] as const).map(([k, l]) => (
                      <button key={k} onClick={() => setReportFilter(k)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: reportFilter === k ? COLORS.primary : '#fff', color: reportFilter === k ? '#fff' : '#8a847c', boxShadow: '0 0 0 1.5px #e6e2dc' }}>{l} ({dailyReports.filter(r => k === 'active' ? (r.status === 'processing' || r.status === 'draft') : r.status === k).length})</button>
                    ))}
                    <div style={{ width: 1, height: 20, background: '#e6e2dc' }} />
                    <input type="date" value={reportDateFrom} onChange={e => setReportDateFrom(e.target.value)} style={{ padding: '4px 8px', borderRadius: 7, border: '1.5px solid #e6e2dc', fontSize: 12, fontFamily: 'inherit' }} />
                    <span style={{ fontSize: 12, color: '#8a847c' }}>—</span>
                    <input type="date" value={reportDateTo} onChange={e => setReportDateTo(e.target.value)} style={{ padding: '4px 8px', borderRadius: 7, border: '1.5px solid #e6e2dc', fontSize: 12, fontFamily: 'inherit' }} />
                    {(reportDateFrom || reportDateTo) && <button onClick={() => { setReportDateFrom(''); setReportDateTo('') }} style={{ padding: '4px 8px', borderRadius: 7, border: 'none', background: '#faeaea', color: '#b03020', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✕ Даты</button>}
                    <button onClick={() => loadDailyReports()} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 7, border: '1.5px solid #e6e2dc', background: '#fff', fontSize: 13, cursor: 'pointer' }}>⟳</button>

                  </div>

                  {reportsError
                    ? <div style={{ color: '#b03020', fontSize: 13, padding: '20px 0', fontWeight: 600 }}>⚠️ Ошибка загрузки отчётов. Нажмите ⟳ или обновите страницу.</div>
                    : filtered.length === 0
                    ? <div style={{ color: '#8a847c', fontSize: 13, padding: '20px 0' }}>Нет отчётов</div>
                    : filtered.map(r => (
                      <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: 18, marginBottom: 12, boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{r.logist?.name} · {fmtDate(r.date)}</div>
                            {r.comment && <div style={{ fontSize: 12, color: '#8a847c', marginTop: 2 }}>{r.comment}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <StatusBadge status={r.status === 'draft' ? 'Не закрыта' : r.status === 'processing' ? 'Новый' : r.status === 'done' ? 'Принят' : 'Архив'} />
                            {r.status === 'processing' && (
                              <Btn size="sm" variant="primary" onClick={async () => {
                                await updateDailyReport(r.id, 'done')
                                loadDailyReports()
                                showToast('✓ Отчёт принят')
                              }}>✓ Принять</Btn>
                            )}
                            {r.status === 'done' && (
                              <Btn size="sm" onClick={async () => {
                                await updateDailyReport(r.id, 'archive')
                                loadDailyReports()
                                showToast('✓ Отправлен в архив')
                              }}>→ Архив</Btn>
                            )}
                          </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 600 }}>
                            <thead>
                              <tr style={{ background: '#f8f6f3' }}>
                                {['ОТ КОГО', 'НАИМ.', 'ПРИХОД', 'КОММ.', 'КОМУ', 'РАСХОД', 'КОММ.', '№ НАКЛ.'].map(h => (
                                  <th key={h} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#8a847c', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {r.rows.map((row, i) => (
                                <tr key={row.id} style={{ borderTop: '1px solid #f1efec' }}>
                                  {[row.fromWho, row.name, row.qtyIn, row.commentIn, row.toWho, row.qtyOut, row.commentOut, row.invoiceNum].map((v, j) => (
                                    <td key={j} style={{ padding: '6px 10px', color: v ? '#26231f' : '#b8b1a6' }}>{v || '—'}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )
            })()}
          {/* ── СМЕНЫ ── */}
            {bookTab === 'shifts' && (() => {
              // Архив закрытых смен
              const archivedReports = dailyReports.filter(r => r.status === 'archive')
              const byDate: Record<string, typeof archivedReports> = {}
              archivedReports.forEach(r => {
                const d = r.date ? r.date.slice(0, 10) : 'unknown'
                if (!byDate[d]) byDate[d] = []
                byDate[d].push(r)
              })
              const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

              return (
                <div>
                  {/* Кнопка закрыть смену */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: '#8a847c' }}>
                      Принятых отчётов: <strong style={{ color: '#26231f' }}>{dailyReports.filter(r => r.status === 'done').length}</strong>
                    </div>
                    <button onClick={async () => {
                      const toClose = dailyReports.filter(r => r.status === 'done')
                      if (toClose.length === 0) { showToast('Нет принятых отчётов для закрытия'); return }
                      await Promise.all(toClose.map(r => updateDailyReport(r.id, 'archive')))
                      loadDailyReports()
                      showToast(`✓ Смена закрыта — ${toClose.length} отчётов`)
                    }} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: COLORS.primary, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✓ Закрыть смену
                    </button>
                  </div>

                  {/* Архив закрытых смен по датам */}
                  {dates.length === 0
                    ? <div style={{ color: '#8a847c', fontSize: 13, padding: '20px 0' }}>Нет закрытых смен</div>
                    : dates.map(date => {
                        const reps = byDate[date]
                        const totalRows = reps.reduce((sum, r) => sum + r.rows.length, 0)
                        return (
                          <div key={date} style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 14, boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 15 }}>📅 {new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                                <div style={{ fontSize: 12, color: '#8a847c', marginTop: 2 }}>{reps.length} логистов · {totalRows} позиций</div>
                              </div>
                              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#e8f5ee', color: '#2e8a5e', fontWeight: 600 }}>✓ Закрыта</span>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 600 }}>
                                <thead><tr style={{ background: '#f8f6f3' }}>
                                  {['ЛОГИСТ', 'ОТ КОГО', 'НАИМ.', 'ПРИХОД', 'КОМУ', 'РАСХОД'].map(h => (
                                    <th key={h} style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#8a847c', textAlign: 'left' }}>{h}</th>
                                  ))}
                                </tr></thead>
                                <tbody>
                                  {reps.map(r => r.rows.map((row, i) => (
                                    <tr key={row.id} style={{ borderTop: '1px solid #f1efec' }}>
                                      <td style={{ padding: '6px 10px', fontWeight: 600, color: COLORS.primary }}>{i === 0 ? r.logist?.name : ''}</td>
                                      <td style={{ padding: '6px 10px' }}>{row.fromWho || '—'}</td>
                                      <td style={{ padding: '6px 10px', fontWeight: 500 }}>{row.name || '—'}</td>
                                      <td style={{ padding: '6px 10px' }}>{row.qtyIn || '—'}</td>
                                      <td style={{ padding: '6px 10px' }}>{row.toWho || '—'}</td>
                                      <td style={{ padding: '6px 10px' }}>{row.qtyOut || '—'}</td>
                                    </tr>
                                  )))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      })
                  }
                </div>
              )
            })()}
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
      // ─── НОМЕНКЛАТУРА ────────────────────────────────────────────────────
      case 'nomenclature':
        return <NomenclatureScreen />

            case 'settings': {
        const stabs: Array<[SettingsTab, string]> = [['users', `Пользователи`], ['projects', 'Проекты'], ['specprojects', 'СпецПроекты'], ['nomenclature', 'Номенклатура'], ['payment', 'Оплата']]
        const roleColors: Record<string, { bg: string; color: string }> = {
          super_admin: { bg: '#eef2ff', color: '#4a5aaa' }, bookkeeper: { bg: '#e8f5ee', color: '#2e8a5e' },
          logist: { bg: '#fff0ea', color: '#c0532a' }, supplier_client: { bg: '#f3eeff', color: '#7a3aaa' }, client: { bg: '#eef8ff', color: '#2a7aaa' }, branch: { bg: '#e8f5ee', color: '#2e8a5e' },
        }
        const roleLabel: Record<string, string> = { super_admin: 'Супер-Админ', bookkeeper: 'Бухгалтер', logist: 'Логист', supplier_client: 'Поставщик/заказчик', client: 'Клиент', branch: 'Филиал' }
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
                        const accessUrl = u.role === 'branch' ? `${base}/branch/${u.slug}` : (u.role === 'client' || u.role === 'supplier_client') ? `${base}/client/${u.slug}` : u.role === 'logist' ? `${base}/rsp/${u.slug}` : ''
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
                              {user.role === 'super_admin' && (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <Btn size="sm" onClick={() => setEditingUser(u)}>Изменить</Btn>
                                  <Btn size="sm" variant="danger" onClick={async () => {
                                    if (!confirm(`Удалить пользователя "${u.name}"? Это действие нельзя отменить.`)) return
                                    try {
                                      const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
                                      const data = await res.json()
                                      if (!res.ok) {
                                        showToast(data.error || 'Ошибка удаления')
                                        return
                                      }
                                      loadSettings()
                                      showToast(`✓ Пользователь "${u.name}" удалён`)
                                    } catch (e: any) { showToast(e.message || 'Ошибка сети') }
                                  }}>Удалить</Btn>
                                </div>
                              )}
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
                        <tr key={p.id} style={{ borderTop: i > 0 ? '1px solid #f1efec' : 'none' }}>
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

      {/* Overlay для мобильного */}
      {sideOpen && (
        <div onClick={() => setSideOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 99, display: 'none' }} className="mobile-overlay" />
      )}

      {/* Сайдбар */}
      <div style={{ width: 220, background: COLORS.sidebar.bg, display: 'flex', flexDirection: 'column', flexShrink: 0, borderRight: `1px solid ${COLORS.sidebar.border}`, transition: 'transform .25s', zIndex: 100 }} className={sideOpen ? 'sidebar sidebar-open' : 'sidebar'}>
        {/* Лого */}
        <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${COLORS.sidebar.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: COLORS.primary, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>U</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>U-Kan</div>
              <div style={{ color: COLORS.sidebar.muted, fontSize: 10 }}>v1.0</div>
            </div>
            <button onClick={() => setSideOpen(false)} className="sidebar-close" style={{ background: 'none', border: 'none', color: COLORS.sidebar.muted, cursor: 'pointer', fontSize: 20, padding: '4px', display: 'none' }}>✕</button>
          </div>
        </div>

        {/* Навигация */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV.map(({ key, label, icon }) => {
            const isActive = screen === key
            const count = counts[key]
            return (
              <button key={key} onClick={() => setScreen(key as AdminScreen)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', border: 'none', background: isActive ? 'rgba(212,97,58,.15)' : 'transparent', color: isActive ? COLORS.sidebar.active : COLORS.sidebar.text, cursor: 'pointer', fontFamily: 'inherit', fontWeight: isActive ? 700 : 400, fontSize: 13, textAlign: 'left', borderLeft: `3px solid ${isActive ? COLORS.sidebar.active : 'transparent'}` }}>
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
          <button onClick={() => setSideOpen(p => !p)} className="hamburger" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: '2px 6px', color: '#26231f', display: 'none', flexShrink: 0 }}>☰</button>
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
          settings={settings}
          myId={user.id}
        />
      )}

      {/* Плавающий чат-виджет */}
      <ChatWidget myId={user.id} />

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
                  {[['super_admin', 'Супер-Админ'], ['bookkeeper', 'Бухгалтер'], ['logist', 'Логист'], ['warehouse_manager', 'Кладовщик (Склад)'], ['supplier_client', 'Поставщик/заказчик'], ['client', 'Клиент'], ['branch', 'Филиал']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
                  {[['super_admin', 'Супер-Админ'], ['bookkeeper', 'Бухгалтер'], ['logist', 'Логист'], ['supplier_client', 'Поставщик/заказчик'], ['client', 'Клиент'], ['branch', 'Филиал']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
                  <div>
                    <label style={LBL}>НАИМ.</label>
                    <NomSearch
                      value={item.name}
                      onChange={(name, unit) => setNewSpec(p => ({ ...p, items: p.items.map((x, idx) => idx === i ? { ...x, name, ...(unit && !x.unit ? { unit } : {}) } : x) }))}
                      placeholder="Поиск..."
                    />
                  </div>
                  <div><label style={LBL}>КОЛ-ВО</label><input style={{ ...INP, width: 80 }} type="number" inputMode="decimal" value={item.qty || ''} onChange={e => setNewSpec(p => ({ ...p, items: p.items.map((x, idx) => idx === i ? { ...x, qty: e.target.value } : x) }))} /></div>
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
