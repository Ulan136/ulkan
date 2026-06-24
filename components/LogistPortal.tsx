'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchAllOrders, orderAction, createOrder, createDailyReport, fetchDailyReports, logout } from '@/lib/api'
import { Order, SessionUser, DailyReport } from '@/lib/types'

// ─── Константы ───────────────────────────────────────────────────────────────
const PRIMARY = '#d4613a'
const DARK    = '#211f1c'
const DARK2   = '#322f2b'
const BG      = '#dedbd6'

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2300); return () => clearTimeout(t) }, [onClose])
  return <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: DARK, color: '#fff', padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 9999, whiteSpace: 'nowrap' }}>{msg}</div>
}

// ─── Статус бейдж ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'В работе':          { bg: '#fff0ea', color: '#c0532a' },
    'Готово к отгрузке': { bg: '#fdf8e1', color: '#8a6f00' },
    'В пути':            { bg: '#fdf8e1', color: '#8a6f00' },
    'Доставлено':        { bg: '#e8f5ee', color: '#2e8a5e' },
  }
  const s = map[status] || { bg: '#efece8', color: '#6b655b' }
  return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: s.bg, color: s.color }}>{status}</span>
}

// ─── Типы ────────────────────────────────────────────────────────────────────
interface ReportRow {
  id: string
  name: string
  qtyIn: string
  fromWho: string
  commentIn: string
  toWho: string
  qtyOut: string
  commentOut: string
}

interface Props {
  user: SessionUser
  logistUser: { name: string; slug: string }
}

type Tab = 'in' | 'out' | 'new' | 'shift'

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function LogistPortal({ user, logistUser }: Props) {
  const [tab, setTab] = useState<Tab>('in')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  // Вкладка Новый
  const [newTo, setNewTo] = useState('')
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newLoading, setNewLoading] = useState(false)

  // Вкладка Смена — строки отчёта
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10))
  const [reportComment, setReportComment] = useState('')
  const [rows, setRows] = useState<ReportRow[]>([newRow()])
  const [reportSent, setReportSent] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [sentReport, setSentReport] = useState<DailyReport | null>(null)

  // Модалка добавления строки
  const [showAddRow, setShowAddRow] = useState(false)
  const [addRowData, setAddRowData] = useState<Omit<ReportRow, 'id'>>({ name: '', qtyIn: '', fromWho: '', commentIn: '', toWho: '', qtyOut: '', commentOut: '' })
  const [editRowId, setEditRowId] = useState<string | null>(null)

  function newRow(): ReportRow {
    return { id: Date.now().toString(), name: '', qtyIn: '', fromWho: '', commentIn: '', toWho: '', qtyOut: '', commentOut: '' }
  }

  const myName = logistUser.name

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await fetchAllOrders() as Order[]
      setOrders(all)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Позиции КО МНЕ — resp === моё имя, статус не Доставлено
  const posIn = orders.flatMap(o =>
    o.positions
      .filter(p => p.resp === myName && p.status !== 'Доставлено')
      .map(p => ({ pos: p, order: o }))
  )

  // Позиции ОТ МЕНЯ — from карточки === моё имя или создана мной
  const posOut = orders.flatMap(o =>
    o.positions
      .filter(p => (o.from === myName || p.resp === myName) && p.status !== 'Доставлено')
      .map(p => ({ pos: p, order: o }))
  )

  // Плитки смены
  const shiftTotal = rows.filter(r => r.name).length
  const shiftIn = rows.filter(r => r.name && Number(r.qtyIn) > 0).length
  const shiftOut = rows.filter(r => r.name && Number(r.qtyOut) > 0).length

  async function handlePosStatus(cardId: string, posId: string, status: string) {
    setUpdating(posId)
    try {
      await orderAction(cardId, 'updatePos', { posId, status })
      showToast(`✓ ${status}`)
      load()
    } catch (e: any) { showToast(e.message) }
    finally { setUpdating(null) }
  }

  async function handleNewOrder() {
    if (!newTo || !newName || !newQty) { showToast('Заполните все поля'); return }
    setNewLoading(true)
    try {
      await createOrder({
        from: myName, to: newTo, comment: newName,
        source: 'responsible_portal',
        positions: [{ name1c: newName, oral: newName, qty: Number(newQty), unit: 'шт', resp: myName, status: 'В работе' }],
      })
      setNewTo(''); setNewName(''); setNewQty('')
      showToast('✓ Позиция создана')
      load()
    } catch (e: any) { showToast(e.message) }
    finally { setNewLoading(false) }
  }

  async function handleSubmitReport() {
    const validRows = rows.filter(r => r.name)
    if (validRows.length === 0) { showToast('Добавьте хотя бы одну строку'); return }
    setReportLoading(true)
    try {
      const report = await createDailyReport({
        date: reportDate, comment: reportComment,
        rows: validRows.map(r => ({
          name: r.name, fromWho: r.fromWho, qtyIn: Number(r.qtyIn) || 0, commentIn: r.commentIn,
          toWho: r.toWho, qtyOut: Number(r.qtyOut) || 0, commentOut: r.commentOut, invoiceNum: '',
        })),
      }) as DailyReport
      setSentReport(report)
      setReportSent(true)
      showToast('✓ Отчёт отправлен в бухгалтерию')
    } catch (e: any) { showToast(e.message) }
    finally { setReportLoading(false) }
  }

  function handleSaveRow() {
    if (!addRowData.name) { showToast('Укажите наименование'); return }
    if (editRowId) {
      setRows(prev => prev.map(r => r.id === editRowId ? { ...r, ...addRowData } : r))
    } else {
      setRows(prev => [...prev, { id: Date.now().toString(), ...addRowData }])
    }
    setAddRowData({ name: '', qtyIn: '', fromWho: '', commentIn: '', toWho: '', qtyOut: '', commentOut: '' })
    setEditRowId(null)
    setShowAddRow(false)
  }

  function startEdit(row: ReportRow) {
    setAddRowData({ name: row.name, qtyIn: row.qtyIn, fromWho: row.fromWho, commentIn: row.commentIn, toWho: row.toWho, qtyOut: row.qtyOut, commentOut: row.commentOut })
    setEditRowId(row.id)
    setShowAddRow(true)
  }

  function showToast(msg: string) { setToast(msg) }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 13px', borderRadius: 8, fontSize: 14, border: '1.5px solid #e6e2dc', background: '#fff', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#8a847c', marginBottom: 4, display: 'block', letterSpacing: '.04em' }

  return (
    <div style={{ background: BG, minHeight: '100vh', fontFamily: "'Golos Text', system-ui, sans-serif" }}>
      {toast && <Toast msg={toast} onClose={() => setToast('')} />}

      {/* ── Шапка ── */}
      <div style={{ background: DARK, padding: '14px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: PRIMARY, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15 }}>U</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>U-Kan · Портал</div>
              <div style={{ color: '#8c857a', fontSize: 11 }}>{myName}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={load} style={{ background: DARK2, border: 'none', borderRadius: 7, padding: '6px 10px', color: '#cfc9c0', cursor: 'pointer', fontSize: 14 }}>⟳</button>
            <button onClick={logout} style={{ background: DARK2, border: 'none', borderRadius: 7, padding: '6px 12px', color: '#cfc9c0', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Выйти</button>
          </div>
        </div>
      </div>

      {/* ── Контент ── */}
      <div style={{ padding: '16px 14px 90px' }}>

        {/* ─── 📥 ВХОДЯЩИЕ ─────────────────────────────────────────── */}
        {tab === 'in' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, color: DARK }}>📥 Входящие · ко мне</div>
            {loading
              ? <div style={{ textAlign: 'center', padding: 40, color: '#8a847c' }}>Загрузка...</div>
              : posIn.length === 0
              ? (
                <div style={{ background: '#fff', borderRadius: 14, padding: 36, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
                  <div style={{ color: '#8a847c', fontSize: 14 }}>Нет входящих позиций</div>
                </div>
              )
              : posIn.map(({ pos, order }) => (
                <div key={pos.id} style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
                  {/* Наименование + кол-во */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{pos.name1c || pos.oral}</div>
                    <span style={{ fontWeight: 700, fontSize: 18, color: PRIMARY, marginLeft: 12 }}>{pos.qty} {pos.unit}</span>
                  </div>
                  {/* Маршрут */}
                  <div style={{ fontSize: 13, color: '#8a847c', marginBottom: 4 }}>{order.from} → {order.to || '—'}</div>
                  {/* ID */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: PRIMARY, fontWeight: 600 }}>{order.id}</span>
                    <StatusBadge status={pos.status} />
                    {pos.late && <span style={{ fontSize: 10, background: '#faeaea', color: '#b03020', padding: '1px 6px', borderRadius: 20, fontWeight: 600 }}>ПРОСРОЧ.</span>}
                  </div>
                  {/* 3 кнопки статуса */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {[
                      { label: 'ПРИНЯЛ', status: 'В работе' },
                      { label: 'В РАБОТЕ', status: 'В пути' },
                      { label: 'ДОСТАВЛЕНО', status: 'Доставлено' },
                    ].map(({ label, status }) => {
                      const isActive = pos.status === status || (label === 'ПРИНЯЛ' && pos.status === 'В работе') || (label === 'В РАБОТЕ' && pos.status === 'В пути')
                      const isDone = pos.status === 'Доставлено'
                      return (
                        <button
                          key={label}
                          onClick={() => handlePosStatus(order.id, pos.id, status)}
                          disabled={updating === pos.id || isDone}
                          style={{
                            padding: '10px 4px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 11,
                            cursor: updating === pos.id || isDone ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                            background: isActive ? PRIMARY : '#f1efec',
                            color: isActive ? '#fff' : '#8a847c',
                            opacity: updating === pos.id ? .6 : 1,
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ─── 📤 ИСХОДЯЩИЕ ─────────────────────────────────────────── */}
        {tab === 'out' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, color: DARK }}>📤 Исходящие · от меня</div>
            {loading
              ? <div style={{ textAlign: 'center', padding: 40, color: '#8a847c' }}>Загрузка...</div>
              : posOut.length === 0
              ? (
                <div style={{ background: '#fff', borderRadius: 14, padding: 36, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
                  <div style={{ color: '#8a847c', fontSize: 14 }}>Нет исходящих позиций</div>
                </div>
              )
              : posOut.map(({ pos, order }) => (
                <div key={pos.id} style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{pos.name1c || pos.oral}</div>
                    <span style={{ fontWeight: 700, fontSize: 18, color: PRIMARY, marginLeft: 12 }}>{pos.qty} {pos.unit}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#8a847c', marginBottom: 4 }}>{order.from} → {order.to || '—'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: PRIMARY, fontWeight: 600 }}>{order.id}</span>
                    <StatusBadge status={pos.status} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {[
                      { label: 'ПРИНЯЛ', status: 'В работе' },
                      { label: 'В РАБОТЕ', status: 'В пути' },
                      { label: 'ДОСТАВЛЕНО', status: 'Доставлено' },
                    ].map(({ label, status }) => {
                      const isActive = (label === 'ПРИНЯЛ' && pos.status === 'В работе') || (label === 'В РАБОТЕ' && pos.status === 'В пути') || (label === 'ДОСТАВЛЕНО' && pos.status === 'Доставлено')
                      return (
                        <button key={label} onClick={() => handlePosStatus(order.id, pos.id, status)} disabled={updating === pos.id}
                          style={{ padding: '10px 4px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: isActive ? PRIMARY : '#f1efec', color: isActive ? '#fff' : '#8a847c' }}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ─── ➕ НОВЫЙ ─────────────────────────────────────────────── */}
        {tab === 'new' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, color: DARK }}>➕ Новая позиция</div>
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>ОТ КОГО</label>
                <input style={{ ...inp, background: '#f8f6f3', color: '#8a847c' }} value={myName} disabled />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>КОМУ *</label>
                <input style={inp} value={newTo} onChange={e => setNewTo(e.target.value)} placeholder="Получатель..." />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>НАИМЕНОВАНИЕ *</label>
                <input style={inp} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Название товара..." />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>КОЛ-ВО *</label>
                <input style={inp} type="number" value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="0" />
              </div>
              <button onClick={handleNewOrder} disabled={newLoading}
                style={{ width: '100%', padding: '13px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', opacity: newLoading ? .6 : 1 }}>
                {newLoading ? 'Создание...' : 'СОЗДАТЬ ПОЗИЦИЮ →'}
              </button>
            </div>
          </div>
        )}

        {/* ─── 📊 СМЕНА ────────────────────────────────────────────── */}
        {tab === 'shift' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: DARK }}>📊 Отчёт по смене</div>
            <div style={{ fontSize: 12, color: '#8a847c', marginBottom: 16 }}>
              {new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })} · {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </div>

            {reportSent ? (
              /* ── Отчёт отправлен ── */
              <div>
                <div style={{ background: '#e8f5ee', borderRadius: 14, padding: 24, textAlign: 'center', marginBottom: 16, border: '1.5px solid #b8e0ca' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: '#2e8a5e', marginBottom: 4 }}>Отчёт отправлен!</div>
                  <div style={{ fontSize: 13, color: '#2e8a5e' }}>Ожидает подтверждения бухгалтера</div>
                </div>
                {/* Просмотр отправленного */}
                <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Строки отчёта ({rows.filter(r => r.name).length})</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                      <thead>
                        <tr style={{ background: '#f8f6f3' }}>
                          {['НАИМЕНОВАНИЕ', 'ШТ', 'ОТ КОГО', 'КОММ.', 'КОМУ', 'ШТ', 'КОММ.'].map(h => (
                            <th key={h} style={{ padding: '7px 8px', fontSize: 10, fontWeight: 700, color: '#8a847c', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.filter(r => r.name).map((r, i) => (
                          <tr key={r.id} style={{ borderTop: '1px solid #f1efec' }}>
                            <td style={{ padding: '7px 8px', fontSize: 12, fontWeight: 500 }}>{r.name}</td>
                            <td style={{ padding: '7px 8px', fontSize: 12 }}>{r.qtyIn || '—'}</td>
                            <td style={{ padding: '7px 8px', fontSize: 12 }}>{r.fromWho || '—'}</td>
                            <td style={{ padding: '7px 8px', fontSize: 12, color: '#8a847c' }}>{r.commentIn || '—'}</td>
                            <td style={{ padding: '7px 8px', fontSize: 12 }}>{r.toWho || '—'}</td>
                            <td style={{ padding: '7px 8px', fontSize: 12 }}>{r.qtyOut || '—'}</td>
                            <td style={{ padding: '7px 8px', fontSize: 12, color: '#8a847c' }}>{r.commentOut || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <button onClick={() => { setReportSent(false); setSentReport(null); setRows([newRow()]); setReportComment('') }}
                  style={{ width: '100%', padding: '12px', background: '#fff', border: '1.5px solid #e6e2dc', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Новый отчёт
                </button>
              </div>
            ) : (
              /* ── Заполнение отчёта ── */
              <div>
                {/* Плитки */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Всего', val: shiftTotal, bg: '#fff', color: DARK },
                    { label: 'Приход', val: shiftIn, bg: '#e8f5ee', color: '#2e8a5e' },
                    { label: 'Расход', val: shiftOut, bg: '#fff0ea', color: '#c0532a' },
                  ].map(({ label, val, bg, color }) => (
                    <div key={label} style={{ background: bg, borderRadius: 10, padding: '12px', textAlign: 'center', boxShadow: '0 0 0 1.5px #e6e2dc' }}>
                      <div style={{ fontWeight: 700, fontSize: 24, color }}>{val}</div>
                      <div style={{ fontSize: 11, color: '#8a847c', marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Таблица строк */}
                {rows.filter(r => r.name).length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 14, marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,.06)', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                        <thead>
                          <tr style={{ background: '#f8f6f3' }}>
                            {['НАИМЕНОВАНИЕ', 'ШТ', 'ОТ КОГО', 'КОММ.', 'КОМУ', 'ШТ', 'КОММ.', ''].map(h => (
                              <th key={h} style={{ padding: '8px 8px', fontSize: 10, fontWeight: 700, color: '#8a847c', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.filter(r => r.name).map((r) => (
                            <tr key={r.id} style={{ borderTop: '1px solid #f1efec' }}>
                              <td style={{ padding: '8px 8px', fontSize: 12, fontWeight: 500 }}>{r.name}</td>
                              <td style={{ padding: '8px 8px', fontSize: 12 }}>{r.qtyIn || '—'}</td>
                              <td style={{ padding: '8px 8px', fontSize: 12 }}>{r.fromWho || '—'}</td>
                              <td style={{ padding: '8px 8px', fontSize: 12, color: '#8a847c' }}>{r.commentIn || '—'}</td>
                              <td style={{ padding: '8px 8px', fontSize: 12 }}>{r.toWho || '—'}</td>
                              <td style={{ padding: '8px 8px', fontSize: 12 }}>{r.qtyOut || '—'}</td>
                              <td style={{ padding: '8px 8px', fontSize: 12, color: '#8a847c' }}>{r.commentOut || '—'}</td>
                              <td style={{ padding: '8px 6px' }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => startEdit(r)} style={{ padding: '3px 7px', borderRadius: 6, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                                  <button onClick={() => setRows(prev => prev.filter(x => x.id !== r.id))} style={{ padding: '3px 7px', borderRadius: 6, border: '1.5px solid #faeaea', background: '#fff', cursor: 'pointer', fontSize: 12 }}>🗑</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Кнопка добавить строку */}
                <button onClick={() => { setEditRowId(null); setAddRowData({ name: '', qtyIn: '', fromWho: '', commentIn: '', toWho: '', qtyOut: '', commentOut: '' }); setShowAddRow(true) }}
                  style={{ width: '100%', padding: '11px', border: '2px dashed #d8d3cc', borderRadius: 10, background: 'none', cursor: 'pointer', fontSize: 13, color: '#8a847c', fontFamily: 'inherit', marginBottom: 14 }}>
                  + Добавить строку
                </button>

                {/* Комментарий */}
                <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 14 }}>
                  <label style={lbl}>КОММЕНТАРИЙ К СМЕНЕ</label>
                  <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={reportComment} onChange={e => setReportComment(e.target.value)} placeholder="Общий комментарий..." />
                </div>

                {/* Дата */}
                <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 16 }}>
                  <label style={lbl}>ДАТА ОТЧЁТА</label>
                  <input style={inp} type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
                </div>

                {/* Кнопка отправить */}
                <button onClick={handleSubmitReport} disabled={reportLoading || rows.filter(r => r.name).length === 0}
                  style={{ width: '100%', padding: '15px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', opacity: reportLoading || rows.filter(r => r.name).length === 0 ? .5 : 1 }}>
                  {reportLoading ? 'Отправка...' : '✓ ЗАКРЫТЬ СМЕНУ И ОТПРАВИТЬ В БУХГАЛТЕРИЮ'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Модалка добавления/редактирования строки ── */}
      {showAddRow && (
        <div onClick={() => setShowAddRow(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 20 }}>
              {editRowId ? 'Редактировать строку' : 'Новая строка'}
            </div>

            {/* Порядок: сначала КОМУ → ОТ КОГО → НАИМЕНОВАНИЕ → ШТ и т.д. */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>КОМУ *</label>
              <input style={inp} value={addRowData.toWho} onChange={e => setAddRowData(p => ({ ...p, toWho: e.target.value }))} placeholder="Получатель..." />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>КОЛ-ВО (к получателю)</label>
              <input style={inp} type="number" value={addRowData.qtyOut} onChange={e => setAddRowData(p => ({ ...p, qtyOut: e.target.value }))} placeholder="0" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>КОММЕНТАРИЙ (к получателю)</label>
              <input style={inp} value={addRowData.commentOut} onChange={e => setAddRowData(p => ({ ...p, commentOut: e.target.value }))} placeholder="..." />
            </div>
            <div style={{ height: 1, background: '#f1efec', margin: '4px 0 14px' }} />
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>ОТ КОГО *</label>
              <input style={inp} value={addRowData.fromWho} onChange={e => setAddRowData(p => ({ ...p, fromWho: e.target.value }))} placeholder="Источник..." />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>НАИМЕНОВАНИЕ *</label>
              <input style={inp} value={addRowData.name} onChange={e => setAddRowData(p => ({ ...p, name: e.target.value }))} placeholder="Товар..." />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>КОЛ-ВО (приход)</label>
              <input style={inp} type="number" value={addRowData.qtyIn} onChange={e => setAddRowData(p => ({ ...p, qtyIn: e.target.value }))} placeholder="0" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>КОММЕНТАРИЙ (приход)</label>
              <input style={inp} value={addRowData.commentIn} onChange={e => setAddRowData(p => ({ ...p, commentIn: e.target.value }))} placeholder="..." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setShowAddRow(false)} style={{ padding: '12px', borderRadius: 10, border: '1.5px solid #e6e2dc', background: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Отмена</button>
              <button onClick={handleSaveRow} style={{ padding: '12px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                {editRowId ? 'Сохранить' : 'Добавить →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Нижнее меню (fixed) ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: DARK, padding: '10px 0 16px', zIndex: 100 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', maxWidth: 432, margin: '0 auto' }}>
          {[
            { key: 'in' as Tab, icon: '📥', label: 'Входящие', badge: posIn.length },
            { key: 'out' as Tab, icon: '📤', label: 'Исходящие', badge: posOut.length },
            { key: 'new' as Tab, icon: '➕', label: 'Новый', badge: 0 },
            { key: 'shift' as Tab, icon: '📊', label: 'Смена', badge: rows.filter(r => r.name).length },
          ].map(({ key, icon, label, badge }) => (
            <button key={key} onClick={() => setTab(key)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative' }}>
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                {badge > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -8, background: PRIMARY, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 10, minWidth: 14, textAlign: 'center' }}>{badge}</span>
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: tab === key ? 700 : 400, color: tab === key ? PRIMARY : '#8c857a' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
