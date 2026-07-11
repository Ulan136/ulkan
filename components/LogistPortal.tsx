'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { orderAction, createOrder, createDailyReport, logout } from '@/lib/api'
import InstallPrompt from '@/components/InstallPrompt'
import { Order, SessionUser } from '@/lib/types'

const PRIMARY = '#d4613a'
const DARK    = '#211f1c'
const DARK2   = '#322f2b'

// Даты по Asia/Almaty (UTC+5, без DST)
const ALMATY_OFFSET = 5 * 60 * 60 * 1000
function isAlmatyToday(iso?: string | null): boolean {
  if (!iso) return false
  const d = new Date(new Date(iso).getTime() + ALMATY_OFFSET)
  const now = new Date(Date.now() + ALMATY_OFFSET)
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate()
}
// 'YYYY-MM-DD' по дню Алматы
function almatyTodayStr(): string {
  return new Date(Date.now() + ALMATY_OFFSET).toISOString().slice(0, 10)
}
function almatyDateStr(iso: string): string {
  return new Date(new Date(iso).getTime() + ALMATY_OFFSET).toISOString().slice(0, 10)
}
function fmtAlmatyDate(iso: string): string {
  const [y, m, d] = almatyDateStr(iso).split('-')
  return `${d}.${m}.${y}`
}
function mapDraftRows(rows: any[]): ShiftRow[] {
  return (rows || []).map((r: any) => ({
    id: r.id, name: r.name, qtyIn: String(r.qtyIn || 0), fromWho: r.fromWho || '',
    commentIn: r.commentIn || '', toWho: r.toWho || '', qtyOut: String(r.qtyOut || 0),
    commentOut: r.commentOut || '', invoiceNum: r.invoiceNum || '', auto: true,
  }))
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2300); return () => clearTimeout(t) }, [onClose])
  return <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: DARK, color: '#fff', padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 9999, whiteSpace: 'nowrap' }}>{msg}</div>
}

// ─── Типы ─────────────────────────────────────────────────────────────────────
interface ShiftRow {
  id: string
  name: string       // наименование товара
  qtyIn: string      // кол-во приход (принято у поставщика)
  fromWho: string    // ОТ КОГО = поставщик позиции (у кого забрал)
  commentIn: string  // комментарий приход
  toWho: string      // КОМУ = клиент (order.to, куда доставил)
  qtyOut: string     // кол-во расход (отдано клиенту)
  commentOut: string // комментарий расход
  invoiceNum: string // № накладной
  auto: boolean      // автоматически добавлена
}

interface Props { user: SessionUser; logistUser: { name: string; slug: string } }
type Tab = 'in' | 'out' | 'new' | 'shift'

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function LogistPortal({ user, logistUser }: Props) {
  const [tab, setTab] = useState<Tab>('in')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  // Новый заказ
  const [newTo, setNewTo] = useState('')
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newLoading, setNewLoading] = useState(false)

  // Отчёт по смене
  const [reportDate, setReportDate] = useState(almatyTodayStr())
  const [reportComment, setReportComment] = useState('')
  const [shiftRows, setShiftRows] = useState<ShiftRow[]>([])
  const [showAddRow, setShowAddRow] = useState(false)
  const [editRow, setEditRow] = useState<ShiftRow | null>(null)
  const [addData, setAddData] = useState({ name: '', qtyIn: '', fromWho: '', commentIn: '', toWho: '', qtyOut: '', commentOut: '', invoiceNum: '' })
  const [reportSent, setReportSent] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  // editingDate = null → сегодняшняя смена; 'YYYY-MM-DD' → редактируем прошлую смену
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [pastDrafts, setPastDrafts] = useState<{ id: string; date: string; rowCount: number }[]>([])

  const myName = logistUser.name
  // Сравнение имён без учёта регистра и лишних пробелов
  const eqName = (a?: string, b?: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()

  const showMsg = useCallback((msg: string) => setToast(msg), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/logist/orders')
      if (res.status === 401 || res.status === 403) { setSessionExpired(true); return }
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch (e: any) {
      // Тихая ошибка при polling — не показываем toast
      console.error('load error:', e.message)
    }
    finally { setLoading(false) }
  }, [])

  // Загрузка при монтировании
  useEffect(() => { load() }, [load])

  // Автообновление каждые 30 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      load()
    }, 5000)
    return () => clearInterval(interval)
  }, [load])

  // ── Позиции КО МНЕ (resp = моё имя, leg=2 — второе плечо, статус не Доставлено) ──
  const posIn = orders.flatMap(o =>
    o.positions
      .filter(p => eqName(p.resp, myName) && p.leg === 2 && p.status !== 'Доставлено')
      .map(p => ({ pos: p, order: o }))
  )

  // ── Позиции ОТ МЕНЯ (карточки которые Я создал; только leg=2) ──
  const posOut = orders.flatMap(o =>
    eqName(o.from, myName)
      ? o.positions.filter(p => p.leg === 2).map(p => ({ pos: p, order: o }))
      : []
  )

  // ── Мои доставленные позиции ЗА СЕГОДНЯ (leg=2) — для автосбора смены ──
  // Фильтр по updatedAt (момент доставки) в пределах суток Алматы, чтобы вчерашние
  // доставки не попадали в сегодняшнюю смену.
  const completedToday = orders.flatMap(o =>
    o.positions
      .filter(p => eqName(p.resp, myName) && p.leg === 2 && p.status === 'Доставлено' && isAlmatyToday(p.updatedAt))
      .map(p => ({ pos: p, order: o }))
  )

  // Загрузка черновика (сегодняшнего или конкретного дня).
  // replace=false — не затирать уже подмешанные авто-строки при пустом ответе.
  const loadDraft = useCallback(async (date?: string | null, replace = true) => {
    try {
      const res = await fetch('/api/reports/draft' + (date ? `?date=${date}` : ''))
      if (res.status === 401 || res.status === 403) { setSessionExpired(true); return }
      if (!res.ok) return
      const data = await res.json()
      const rows: ShiftRow[] = data?.rows?.length ? mapDraftRows(data.rows) : []
      if (rows.length > 0) { setShiftRows(rows); setReportComment(data?.comment || '') }
      else if (replace) { setShiftRows([]); setReportComment('') }
    } catch {}
  }, [])

  // Список незакрытых черновиков за прошлые дни (для баннера)
  const loadPast = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/draft?scope=past')
      if (!res.ok) return
      const data = await res.json()
      setPastDrafts(Array.isArray(data) ? data : [])
    } catch {}
  }, [])

  useEffect(() => { loadDraft(null, false); loadPast() }, [loadDraft, loadPast])

  // Открыть прошлую смену для дозаполнения и закрытия
  async function openPastDraft(iso: string) {
    const dateStr = almatyDateStr(iso)
    setEditingDate(dateStr)
    setReportDate(dateStr)
    setReportSent(false)
    await loadDraft(dateStr, true)
  }
  // Вернуться к сегодняшней смене
  async function backToToday() {
    setEditingDate(null)
    setReportDate(almatyTodayStr())
    setReportSent(false)
    await loadDraft(null, true)
  }

  // Автодобавление новых доставленных позиций в смену (только для сегодняшней)
  useEffect(() => {
    if (editingDate) return  // редактируем прошлую смену — сегодняшние доставки не подмешиваем
    if (completedToday.length === 0) return
    setShiftRows(prev => {
      const existingIds = new Set(prev.map(r => r.id))
      const newRows: ShiftRow[] = completedToday
        .filter(({ pos }) => !existingIds.has(`auto-${pos.id}`))
        .map(({ pos, order }) => ({
          id: `auto-${pos.id}`,
          name: pos.name1c || pos.oral,
          qtyIn: String(pos.qty),
          fromWho: pos.supplier || order.from,   // ОТ КОГО = поставщик (у кого забрал)
          commentIn: '',                          // supplier больше НЕ в комментарии
          toWho: order.to || '',                  // КОМУ = клиент
          qtyOut: String(pos.qty),
          commentOut: '',
          invoiceNum: '',
          auto: true,
        }))
      if (newRows.length === 0) return prev
      return [...prev, ...newRows]
    })
  }, [completedToday.length, editingDate])

  // Автосохранение черновика смены в базу каждые 30 секунд
  useEffect(() => {
    const validRows = shiftRows.filter(r => r.name)
    if (validRows.length === 0) return
    const timer = setTimeout(async () => {
      try {
        await fetch('/api/reports/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: validRows, date: editingDate || undefined }),
        })
      } catch {}
    }, 2000)
    return () => clearTimeout(timer)
  }, [shiftRows, editingDate])

  // ── Смена статуса позиции ──
  async function handleStatus(cardId: string, posId: string, status: string, posName: string, fromWho: string, toWho: string, qty: number) {
    setUpdating(posId)
    try {
      await orderAction(cardId, 'updatePos', { posId, status })
      showMsg(`✓ ${status}`)

      // Если Доставлено — добавляем строку в сегодняшнюю смену (не в открытую прошлую)
      if (status === 'Доставлено' && !editingDate) {
        const autoRow: ShiftRow = {
          id: `auto-${posId}-${Date.now()}`,
          name: posName,
          qtyIn: String(qty),
          fromWho,      // передаётся из PosCard = pos.supplier || order.from
          commentIn: '',
          toWho,
          qtyOut: String(qty),
          commentOut: '',
          invoiceNum: '',
          auto: true,
        }
        setShiftRows(prev => {
          const exists = prev.find(r => r.id === `auto-${posId}`)
          if (exists) return prev
          return [...prev, autoRow]
        })
      }
      await load()
    } catch (e: any) { showMsg(e.message) }
    finally { setUpdating(null) }
  }

  // ── Создать новый заказ ──
  async function handleNew() {
    if (!newTo || !newName || !newQty) { showMsg('Заполните все поля'); return }
    setNewLoading(true)
    try {
      await createOrder({
        from: myName, to: newTo,
        source: 'responsible_portal',
        positions: [{ name1c: newName, oral: newName, qty: Number(newQty), unit: 'шт', resp: myName, status: 'В работе' }],
      })
      setNewTo(''); setNewName(''); setNewQty('')
      showMsg('✓ Заказ создан')
      load()
    } catch (e: any) { showMsg(e.message) }
    finally { setNewLoading(false) }
  }

  // ── Сохранить строку отчёта ──
  function saveRow() {
    if (!addData.name) { showMsg('Укажите наименование'); return }
    if (editRow) {
      setShiftRows(prev => prev.map(r => r.id === editRow.id ? { ...r, ...addData, auto: false } : r))
    } else {
      setShiftRows(prev => [...prev, { id: `manual-${Date.now()}`, ...addData, auto: false }])
    }
    setAddData({ name: '', qtyIn: '', fromWho: '', commentIn: '', toWho: '', qtyOut: '', commentOut: '', invoiceNum: '' })
    setEditRow(null)
    setShowAddRow(false)
  }

  function openEdit(row: ShiftRow) {
    setAddData({ name: row.name, qtyIn: row.qtyIn, fromWho: row.fromWho, commentIn: row.commentIn, toWho: row.toWho, qtyOut: row.qtyOut, commentOut: row.commentOut, invoiceNum: row.invoiceNum || '' })
    setEditRow(row)
    setShowAddRow(true)
  }

  // ── Отправить отчёт ──
  async function submitReport() {
    const validRows = shiftRows.filter(r => r.name)
    if (validRows.length === 0) { showMsg('Добавьте хотя бы одну строку'); return }
    setReportLoading(true)
    try {
      const reportDay = editingDate || reportDate
      await createDailyReport({
        date: reportDay, comment: reportComment,
        rows: validRows.map(r => ({
          name: r.name, fromWho: r.fromWho, qtyIn: Number(r.qtyIn) || 0, commentIn: r.commentIn,
          toWho: r.toWho, qtyOut: Number(r.qtyOut) || 0, commentOut: r.commentOut, invoiceNum: r.invoiceNum || '',
        })),
      })
      // Удаляем черновик того же дня после успешной отправки
      await fetch('/api/reports/draft' + (editingDate ? `?date=${editingDate}` : ''), { method: 'DELETE' }).catch(() => {})
      setShiftRows([])
      setReportComment('')
      setReportSent(true)
      if (editingDate) { setEditingDate(null); setReportDate(almatyTodayStr()) }
      loadPast()
      showMsg('✓ Отчёт отправлен в бухгалтерию!')
    } catch (e: any) { showMsg(e.message) }
    finally { setReportLoading(false) }
  }

  const shiftTotal = shiftRows.filter(r => r.name).length
  const shiftIn    = shiftRows.filter(r => r.name).reduce((s, r) => s + (Number(r.qtyIn) || 0), 0)   // Σ приход
  const shiftOut   = shiftRows.filter(r => r.name).reduce((s, r) => s + (Number(r.qtyOut) || 0), 0)  // Σ расход

  const inp: React.CSSProperties = { width: '100%', padding: '10px 13px', borderRadius: 8, fontSize: 14, border: '1.5px solid #e6e2dc', background: '#fff', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#8a847c', marginBottom: 4, display: 'block', letterSpacing: '.04em' }

  // ── 3 кнопки статуса ──
  function StatusBtns({ cardId, posId, posStatus, posName, fromWho, toWho, qty }: { cardId: string; posId: string; posStatus: string; posName: string; fromWho: string; toWho: string; qty: number }) {
    const btns = [
      { label: 'ПРИНЯЛ',      status: 'В работе'   },
      { label: 'В РАБОТЕ',    status: 'В пути'      },
      { label: 'ДОСТАВЛЕНО',  status: 'Доставлено'  },
    ]
    const activeIdx = posStatus === 'В работе' ? 0 : posStatus === 'В пути' ? 1 : posStatus === 'Доставлено' ? 2 : -1
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12 }}>
        {btns.map((b, i) => (
          <button key={b.label} onClick={() => handleStatus(cardId, posId, b.status, posName, fromWho, toWho, qty)}
            disabled={updating === posId || posStatus === 'Доставлено'}
            style={{ padding: '10px 4px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: i <= activeIdx ? PRIMARY : '#f1efec', color: i <= activeIdx ? '#fff' : '#8a847c', opacity: updating === posId ? .6 : 1 }}>
            {b.label}
          </button>
        ))}
      </div>
    )
  }

  // ── Карточка позиции ──
  function PosCard({ pos, order }: { pos: any; order: Order }) {
    return (
      <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{pos.name1c || pos.oral}</div>
          <span style={{ fontWeight: 700, fontSize: 18, color: PRIMARY, marginLeft: 10 }}>{pos.qty} {pos.unit}</span>
        </div>
        <div style={{ fontSize: 13, color: '#8a847c', marginBottom: 4 }}>{order.from} → {order.to || '—'}</div>
        {order.comment && <div style={{ fontSize: 12, background: '#f8f6f3', borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>{order.comment.slice(0, 80)}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: PRIMARY, fontWeight: 600 }}>{order.id}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#a39c92' }}>{pos.id}</span>
          {pos.late && <span style={{ fontSize: 10, background: '#faeaea', color: '#b03020', padding: '1px 6px', borderRadius: 20, fontWeight: 600 }}>ПРОСРОЧ.</span>}
          <span style={{ fontSize: 10, background: pos.status === 'Доставлено' ? '#e8f5ee' : '#fff0ea', color: pos.status === 'Доставлено' ? '#2e8a5e' : '#c0532a', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{pos.status}</span>
        </div>
        <StatusBtns cardId={order.id} posId={pos.id} posStatus={pos.status} posName={pos.name1c || pos.oral} fromWho={pos.supplier || order.from} toWho={order.to || ''} qty={pos.qty} />
      </div>
    )
  }

  if (sessionExpired) {
    return (
      <div style={{ background: '#dedbd6', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Golos Text', system-ui, sans-serif" }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 340, textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.15)' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Сессия устарела</div>
          <div style={{ color: '#8a847c', fontSize: 14, marginBottom: 18 }}>Войдите заново, чтобы продолжить.</div>
          <button onClick={() => logout()} style={{ padding: '11px 24px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Выйти и войти заново
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#dedbd6', minHeight: '100vh', fontFamily: "'Golos Text', system-ui, sans-serif" }}>
      {toast && <Toast msg={toast} onClose={() => setToast('')} />}

      {/* Шапка */}
      <div style={{ background: DARK, padding: '14px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 432, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: PRIMARY, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15 }}>U</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>U-Kan · Портал</div>
              <div style={{ color: '#8c857a', fontSize: 11 }}>{myName}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={load} style={{ background: DARK2, border: 'none', borderRadius: 7, padding: '6px 10px', color: loading ? '#d4613a' : '#cfc9c0', cursor: 'pointer', fontSize: 14, transition: 'color .3s' }}>
                {loading ? '⟳' : '⟳'}
              </button>
            <button onClick={logout} style={{ background: DARK2, border: 'none', borderRadius: 7, padding: '6px 12px', color: '#cfc9c0', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Выйти</button>
          </div>
        </div>
      </div>

      {/* Контент */}
      <div style={{ maxWidth: 432, margin: '0 auto', padding: '16px 14px 90px' }}>

        {/* ── 📥 ВХОДЯЩИЕ ── */}
        {tab === 'in' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>📥 Входящие · ко мне</div>
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#8a847c' }}>Загрузка...</div>
              : posIn.length === 0
              ? <div style={{ background: '#fff', borderRadius: 14, padding: 36, textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 10 }}>✅</div><div style={{ color: '#8a847c' }}>Нет входящих позиций</div></div>
              : posIn.map(({ pos, order }) => <PosCard key={pos.id} pos={pos} order={order} />)
            }
          </div>
        )}

        {/* ── 📤 ИСХОДЯЩИЕ ── */}
        {tab === 'out' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>📤 Исходящие · от меня</div>
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#8a847c' }}>Загрузка...</div>
              : posOut.length === 0
              ? <div style={{ background: '#fff', borderRadius: 14, padding: 36, textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 10 }}>📭</div><div style={{ color: '#8a847c' }}>Нет исходящих позиций</div></div>
              : posOut.map(({ pos, order }) => <PosCard key={`out-${pos.id}`} pos={pos} order={order} />)
            }
          </div>
        )}

        {/* ── ➕ НОВЫЙ ── */}
        {tab === 'new' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>➕ Новый заказ</div>
            <div style={{ background: '#fff', borderRadius: 14, padding: 20 }}>
              <div style={{ marginBottom: 14 }}><label style={lbl}>ОТ КОГО</label><input style={{ ...inp, background: '#f8f6f3', color: '#8a847c' }} value={myName} disabled /></div>
              <div style={{ marginBottom: 14 }}><label style={lbl}>КОМУ *</label><input style={inp} value={newTo} onChange={e => setNewTo(e.target.value)} placeholder="Получатель..." /></div>
              <div style={{ marginBottom: 14 }}><label style={lbl}>НАИМЕНОВАНИЕ *</label><input style={inp} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Товар..." /></div>
              <div style={{ marginBottom: 20 }}><label style={lbl}>КОЛ-ВО *</label><input style={inp} type="number" value={newQty} onChange={e => setNewQty(e.target.value)} /></div>
              <button onClick={handleNew} disabled={newLoading} style={{ width: '100%', padding: '13px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
                {newLoading ? 'Создание...' : 'СОЗДАТЬ →'}
              </button>
            </div>
          </div>
        )}

        {/* ── 📊 СМЕНА ── */}
        {tab === 'shift' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>📊 Отчёт по смене</div>
            <div style={{ fontSize: 12, color: '#8a847c', marginBottom: 16 }}>
              {new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })} · {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </div>

            {/* Индикатор: редактируем ПРОШЛУЮ смену */}
            {editingDate && !reportSent && (
              <div style={{ background: '#fff0ea', border: '1.5px solid #e6c9b8', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#c0532a', fontWeight: 600 }}>✎ Смена за {editingDate.split('-').reverse().join('.')}</span>
                <button onClick={backToToday} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e6c9b8', background: '#fff', color: '#c0532a', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit' }}>← К сегодняшней</button>
              </div>
            )}

            {/* Баннер: незакрытые смены за прошлые дни */}
            {!editingDate && !reportSent && pastDrafts.length > 0 && (
              <div style={{ background: '#fdf8e1', border: '1.5px solid #f0d98a', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                {pastDrafts.map(pd => (
                  <div key={pd.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '4px 0' }}>
                    <span style={{ fontSize: 13, color: '#8a6f00', fontWeight: 600 }}>⚠ Незакрытая смена за {fmtAlmatyDate(pd.date)} · {pd.rowCount} строк</span>
                    <button onClick={() => openPastDraft(pd.date)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#8a6f00', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', flexShrink: 0 }}>Открыть</button>
                  </div>
                ))}
              </div>
            )}

            {reportSent ? (
              <div>
                <div style={{ background: '#e8f5ee', borderRadius: 14, padding: 24, textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: '#2e8a5e' }}>Отчёт отправлен!</div>
                  <div style={{ fontSize: 13, color: '#2e8a5e', marginTop: 4 }}>Ожидает подтверждения бухгалтера</div>
                </div>
                {/* Таблица отправленного */}
                <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                    <thead><tr style={{ background: '#f8f6f3' }}>
                      {['НАИМ.', 'ОТ КОГО', 'ШТ', 'КОММ.', 'КОМУ', 'ШТ', 'КОММ.', '№ НАКЛ.'].map(h => (
                        <th key={h} style={{ padding: '7px 8px', fontSize: 10, fontWeight: 700, color: '#8a847c', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {shiftRows.filter(r => r.name).map((r, i) => (
                        <tr key={r.id} style={{ borderTop: '1px solid #f1efec' }}>
                          <td style={{ padding: '7px 8px', fontSize: 12, fontWeight: 500 }}>{r.name}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{r.fromWho || '—'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{r.qtyIn || '—'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12, color: '#8a847c' }}>{r.commentIn || '—'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{r.toWho || '—'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12 }}>{r.qtyOut || '—'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12, color: '#8a847c' }}>{r.commentOut || '—'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 12, color: '#8a847c' }}>{r.invoiceNum || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => { setReportSent(false) }} style={{ width: '100%', padding: '12px', background: '#fff', border: '1.5px solid #e6e2dc', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Новый отчёт
                </button>
              </div>
            ) : (
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
                {shiftRows.filter(r => r.name).length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 14, marginBottom: 12, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                        <thead><tr style={{ background: '#f8f6f3' }}>
                          {['НАИМ.', 'ОТ КОГО', 'ШТ', 'КОММ.', 'КОМУ', 'ШТ', 'КОММ.', '№ НАКЛ.', ''].map((h, hi) => (
                            <th key={hi} style={{ padding: '8px', fontSize: 10, fontWeight: 700, color: '#8a847c', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {shiftRows.filter(r => r.name).map(r => (
                            <tr key={r.id} style={{ borderTop: '1px solid #f1efec', background: r.auto ? '#fafff8' : '#fff' }}>
                              <td style={{ padding: '8px', fontSize: 12, fontWeight: 500 }}>{r.name}{r.auto && <span style={{ fontSize: 9, color: '#2e8a5e', marginLeft: 4 }}>авто</span>}</td>
                              <td style={{ padding: '8px', fontSize: 12 }}>{r.fromWho || '—'}</td>
                              <td style={{ padding: '8px', fontSize: 12 }}>{r.qtyIn || '—'}</td>
                              <td style={{ padding: '8px', fontSize: 12, color: '#8a847c' }}>{r.commentIn || '—'}</td>
                              <td style={{ padding: '8px', fontSize: 12 }}>{r.toWho || '—'}</td>
                              <td style={{ padding: '8px', fontSize: 12 }}>{r.qtyOut || '—'}</td>
                              <td style={{ padding: '8px', fontSize: 12, color: '#8a847c' }}>{r.commentOut || '—'}</td>
                              <td style={{ padding: '8px', fontSize: 12, color: '#8a847c' }}>{r.invoiceNum || '—'}</td>
                              <td style={{ padding: '8px' }}>
                                <div style={{ display: 'flex', gap: 3 }}>
                                  <button onClick={() => openEdit(r)} style={{ padding: '3px 6px', borderRadius: 5, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontSize: 11 }}>✏️</button>
                                  <button onClick={() => setShiftRows(prev => prev.filter(x => x.id !== r.id))} style={{ padding: '3px 6px', borderRadius: 5, border: '1.5px solid #faeaea', background: '#fff', cursor: 'pointer', fontSize: 11 }}>🗑</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Добавить строку */}
                <button onClick={() => { setEditRow(null); setAddData({ name: '', qtyIn: '', fromWho: '', commentIn: '', toWho: '', qtyOut: '', commentOut: '', invoiceNum: '' }); setShowAddRow(true) }}
                  style={{ width: '100%', padding: '11px', border: '2px dashed #d8d3cc', borderRadius: 10, background: 'none', cursor: 'pointer', fontSize: 13, color: '#8a847c', fontFamily: 'inherit', marginBottom: 12 }}>
                  + Добавить строку
                </button>

                {/* Дата и комментарий */}
                <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 }}>
                  <div style={{ marginBottom: 12 }}><label style={lbl}>ДАТА</label><input style={inp} type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} /></div>
                  <div><label style={lbl}>КОММЕНТАРИЙ К СМЕНЕ</label><textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={reportComment} onChange={e => setReportComment(e.target.value)} placeholder="Общий комментарий..." /></div>
                </div>

                {/* Кнопка закрыть смену */}
                <button onClick={submitReport} disabled={reportLoading || shiftRows.filter(r => r.name).length === 0}
                  style={{ width: '100%', padding: '15px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', opacity: reportLoading || shiftRows.filter(r => r.name).length === 0 ? .5 : 1 }}>
                  {reportLoading ? 'Отправка...' : '✓ ЗАКРЫТЬ СМЕНУ И ОТПРАВИТЬ В БУХГАЛТЕРИЮ'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Модалка добавления строки (снизу вверх) ── */}
      {showAddRow && (
        <div onClick={() => setShowAddRow(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 20 }}>{editRow ? 'Редактировать строку' : 'Новая строка'}</div>
            {/* Порядок: сначала КОМУ → ОТ КОГО → НАИМЕНОВАНИЕ */}
            {[
              { f: 'toWho',      l: 'КОМУ (клиент) *',       t: 'text',   p: 'Клиент-получатель...' },
              { f: 'qtyOut',     l: 'КОЛ-ВО (клиенту)',      t: 'number', p: '0' },
              { f: 'commentOut', l: 'КОММЕНТАРИЙ (клиенту)', t: 'text',   p: '...' },
              { f: 'invoiceNum', l: '№ НАКЛАДНОЙ',           t: 'text',   p: '№...' },
            ].map(({ f, l, t, p }) => (
              <div key={f} style={{ marginBottom: 12 }}>
                <label style={lbl}>{l}</label>
                <input style={inp} type={t} placeholder={p} value={(addData as any)[f]} onChange={e => setAddData(prev => ({ ...prev, [f]: e.target.value }))} />
              </div>
            ))}
            <div style={{ height: 1, background: '#f1efec', margin: '8px 0 12px' }} />
            {[
              { f: 'fromWho',   l: 'ОТ КОГО (поставщик) *',  t: 'text',   p: 'У кого забрал...' },
              { f: 'name',      l: 'НАИМЕНОВАНИЕ ТОВАРА *',   t: 'text',   p: 'Товар...' },
              { f: 'qtyIn',     l: 'КОЛ-ВО (от поставщика)',  t: 'number', p: '0' },
              { f: 'commentIn', l: 'КОММЕНТАРИЙ (приход)',    t: 'text',   p: '...' },
            ].map(({ f, l, t, p }) => (
              <div key={f} style={{ marginBottom: 12 }}>
                <label style={lbl}>{l}</label>
                <input style={inp} type={t} placeholder={p} value={(addData as any)[f]} onChange={e => setAddData(prev => ({ ...prev, [f]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
              <button onClick={() => setShowAddRow(false)} style={{ padding: '12px', borderRadius: 10, border: '1.5px solid #e6e2dc', background: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Отмена</button>
              <button onClick={saveRow} style={{ padding: '12px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                {editRow ? 'Сохранить' : 'Добавить →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Нижнее меню ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: DARK, padding: '10px 0 16px', zIndex: 100 }}>
        <div style={{ maxWidth: 432, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { key: 'in'    as Tab, icon: '📥', label: 'Входящие',  badge: posIn.length },
            { key: 'out'   as Tab, icon: '📤', label: 'Исходящие', badge: posOut.length },
            { key: 'new'   as Tab, icon: '➕', label: 'Новый',     badge: 0 },
            { key: 'shift' as Tab, icon: '📊', label: 'Смена',     badge: shiftRows.filter(r => r.name).length },
          ].map(({ key, icon, label, badge }) => (
            <button key={key} onClick={() => setTab(key)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative' }}>
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                {badge > 0 && <span style={{ position: 'absolute', top: -4, right: -8, background: PRIMARY, color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 10, minWidth: 14, textAlign: 'center' }}>{badge}</span>}
              </div>
              <span style={{ fontSize: 10, fontWeight: tab === key ? 700 : 400, color: tab === key ? PRIMARY : '#8c857a' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <InstallPrompt />
    </div>
  )
}
