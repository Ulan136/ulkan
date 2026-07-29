'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { orderAction, createOrder, createDailyReport, logout, fetchSettings, fetchNotifications, markNotificationRead } from '@/lib/api'
import { useLiveData } from '@/lib/live'
import { PositionEditor, AddPositionForm, editBtn } from '@/components/PositionEditors'
import CardChat from '@/components/CardChat'
import ChatWidget from '@/components/ChatWidget'
import InstallPrompt from '@/components/InstallPrompt'
import { RalDot, extractRal } from '@/lib/ral'
import DateFilter, { inPeriod, type Period } from '@/components/DateFilter'
import { isPurchase } from '@/lib/procurement'
import { Order, SessionUser, Notification } from '@/lib/types'

const PRIMARY = '#d4613a'
const DARK    = '#211f1c'
const DARK2   = '#322f2b'

// Даты по Asia/Almaty (UTC+5, без DST)
const ALMATY_OFFSET = 5 * 60 * 60 * 1000
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
    id: r.id,                 // реальный id строки в БД (для edit/delete через API)
    posId: r.posId || '',
    name: r.name, qtyIn: String(r.qtyIn || 0), fromWho: r.fromWho || '',
    commentIn: r.commentIn || '', toWho: r.toWho || '', qtyOut: String(r.qtyOut || 0),
    commentOut: r.commentOut || '', invoiceNum: r.invoiceNum || '',
    auto: !!r.posId,          // авто-строка доставки, если есть posId
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
  posId?: string     // id позиции у авто-строк (идемпотентность); пусто у ручных
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
type Tab = 'in' | 'buy' | 'out' | 'changes' | 'new' | 'shift'

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function LogistPortal({ user, logistUser }: Props) {
  const [tab, setTab] = useState<Tab>('in')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  // Редактирование состава заказа логистом
  const editingRef = useRef(false)
  const [editPosId, setEditPosId] = useState<string | null>(null)
  const [addingCardId, setAddingCardId] = useState<string | null>(null)
  const [chatOpenPos, setChatOpenPos] = useState<string | null>(null) // pos.id, у которого раскрыт чат
  const [msgCount, setMsgCount] = useState<Record<string, number>>({}) // по cardId
  const [suppliers, setSuppliers] = useState<string[]>([])

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
  const [period, setPeriod] = useState<Period>('all') // фильтр даты просмотра
  const [day, setDay] = useState('')
  const [notifications, setNotifications] = useState<Notification[]>([]) // сигналы изменений

  const myName = logistUser.name
  // Сравнение имён без учёта регистра и лишних пробелов
  const eqName = (a?: string, b?: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()

  const showMsg = useCallback((msg: string) => setToast(msg), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, notifs] = await Promise.all([
        fetch('/api/logist/orders'),
        fetchNotifications().catch(() => []) as Promise<Notification[]>,
      ])
      if (res.status === 401 || res.status === 403) { setSessionExpired(true); return }
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
      setNotifications(Array.isArray(notifs) ? notifs : [])
    } catch (e: any) {
      // Тихая ошибка при polling — не показываем toast
      console.error('load error:', e.message)
    }
    finally { setLoading(false) }
  }, [])

  // Пауза live-обновления, пока открыт редактор/добавление/ЧАТ. PosCard объявлен
  // ВНУТРИ компонента → любой ре-рендер LogistPortal пересоздаёт его и
  // РАЗМОНТИРУЕТ поддерево (чат/редактор) — из-за чего гибнет клик/ввод. Держим
  // паузу производной от state (обновляется на каждый рендер, не залипает).
  const pausedRef = useRef(false)
  pausedRef.current = editPosId !== null || addingCardId !== null || chatOpenPos !== null

  // Realtime канал 'orders' (+ polling-fallback). Загрузка при монтировании и по сигналу.
  useLiveData('orders', load, [], pausedRef)

  // Список поставщиков для селекта при добавлении позиции (тот же источник, что на приёмке)
  useEffect(() => {
    fetchSettings().then((s: any) => {
      const names = (s?.suppliers || []).map((x: any) => x.name).filter(Boolean)
      setSuppliers(names)
    }).catch(() => {})
  }, [])

  // editingRef не должен залипать: нет открытого редактора → пауза снята (сигналы применяются).
  useEffect(() => { if (editPosId === null && addingCardId === null) editingRef.current = false }, [editPosId, addingCardId])
  // Смена вкладки закрывает редакторы И чат (иначе pausedRef залипнет: карточка
  // ушла из DOM, а chatOpenPos остался → load навсегда на паузе).
  useEffect(() => { setEditPosId(null); setAddingCardId(null); setChatOpenPos(null) }, [tab])
  // Сброс паузы при размонтировании
  useEffect(() => () => { editingRef.current = false }, [])

  // Фильтр по дате просмотра (общий для Входящих/Исходящих).
  const visOrders = orders.filter(o => inPeriod(o.createdAt, period, day))

  // ── Позиции КО МНЕ (resp = моё имя, leg=2 — второе плечо, статус не Доставлено) ──
  // Закуп (получатель Центр-Склад) выносим в отдельную вкладку «Закупки»,
  // Входящие оставляем только для продаж.
  const posInAll = visOrders.flatMap(o =>
    o.positions
      .filter(p => eqName(p.resp, myName) && p.leg === 2 && p.status !== 'Доставлено')
      .map(p => ({ pos: p, order: o }))
  )
  const posIn = posInAll.filter(x => !isPurchase(x.order))   // продажи
  const posBuy = posInAll.filter(x => isPurchase(x.order))   // закупы

  // ── Исходящие · от меня = мои ДОСТАВЛЕННЫЕ позиции (история того, что я отправил).
  // Входящие (активные, ещё не доставлены) → сюда переходят после «Доставлено».
  // Раньше здесь были только карточки, которые логист сам создал (from=я) — почти
  // всегда пусто, поэтому история не появлялась и позиция «сразу уходила в отчёт».
  const posOut = visOrders.flatMap(o =>
    o.positions
      .filter(p => eqName(p.resp, myName) && p.leg === 2 && p.status === 'Доставлено')
      .map(p => ({ pos: p, order: o }))
  )

  // ── ИЗМЕНЕНИЯ: карточки с непрочитанным сигналом (кто-то добавил/изменил позицию).
  // Мигают, пока логист не откроет карточку («✓ Просмотрено» → отметить прочитанным).
  const changedIds = new Set(notifications.filter(n => !n.read && n.cardId).map(n => n.cardId as string))
  const posChanged = orders.flatMap(o =>          // без фильтра даты — изменения видны всегда
    changedIds.has(o.id)
      ? o.positions.filter(p => eqName(p.resp, myName)).map(p => ({ pos: p, order: o }))
      : []
  )
  const changedCount = new Set(posChanged.map(x => x.order.id)).size

  async function markCardSeen(cardId: string) {
    const unread = notifications.filter(n => n.cardId === cardId && !n.read)
    setNotifications(prev => prev.map(n => n.cardId === cardId ? { ...n, read: true } : n)) // оптимистично
    try { await Promise.all(unread.map(n => markNotificationRead(n.id))) } catch {}
  }

  // Загрузка черновика (сегодняшнего или конкретного дня) — ТОЛЬКО показ блока
  // с сервера. Никакой автосборки: строки наполняются событиями (доставка/вручную).
  const loadDraft = useCallback(async (date?: string | null) => {
    try {
      const res = await fetch('/api/reports/draft' + (date ? `?date=${date}` : ''))
      if (res.status === 401 || res.status === 403) { setSessionExpired(true); return }
      if (!res.ok) return
      const data = await res.json()
      setShiftRows(data?.rows?.length ? mapDraftRows(data.rows) : [])
      setReportComment(data?.comment || '')
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

  useEffect(() => { loadDraft(null); loadPast() }, [loadDraft, loadPast])

  // Открыть прошлую смену для дозаполнения и закрытия
  async function openPastDraft(iso: string) {
    const dateStr = almatyDateStr(iso)
    setEditingDate(dateStr)
    setReportDate(dateStr)
    setReportSent(false)
    await loadDraft(dateStr)
  }
  // Вернуться к сегодняшней смене
  async function backToToday() {
    setEditingDate(null)
    setReportDate(almatyTodayStr())
    setReportSent(false)
    await loadDraft(null)
  }

  // НЕТ автосборки и автосейва: строки блока наполняются событиями на сервере
  // (доставка → updatePos, ручная кнопка, откат). Вкладка Смена только показывает.

  // ── Смена поставщика позиции (поставщик может меняться в процессе) ──
  const [supEditPos, setSupEditPos] = useState<string | null>(null)
  async function saveSupplier(cardId: string, posId: string, name: string) {
    try {
      // supplierId=null: логист выбирает по имени; имя-поставщик хранится без FK.
      await orderAction(cardId, 'updatePosDetail', { posId, supplier: name, supplierId: null })
      showMsg('✓ Поставщик изменён')
      setSupEditPos(null)
      await load()
    } catch (e: any) { showMsg(e.message) }
  }

  // ── Смена статуса позиции ──
  async function handleStatus(cardId: string, posId: string, status: string, _posName: string, _fromWho: string, _toWho: string, _qty: number) {
    setUpdating(posId)
    try {
      await orderAction(cardId, 'updatePos', { posId, status })
      showMsg(`✓ ${status}`)
      await load()
      // Строку смены создаёт сервер (updatePos-эффект по событию доставки/отката) —
      // просто перечитываем сегодняшний блок, чтобы показать актуальные строки.
      if (!editingDate) await loadDraft(null)
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

  // ── Сохранить строку отчёта (ручная строка / правка) — через API ──
  async function saveRow() {
    if (!addData.name) { showMsg('Укажите наименование'); return }
    try {
      const body = editRow
        ? { op: 'update', id: editRow.id, row: addData }
        : { op: 'add', row: addData, date: editingDate || undefined }
      const res = await fetch('/api/reports/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { showMsg('Не удалось сохранить строку'); return }
      setAddData({ name: '', qtyIn: '', fromWho: '', commentIn: '', toWho: '', qtyOut: '', commentOut: '', invoiceNum: '' })
      setEditRow(null)
      setShowAddRow(false)
      await loadDraft(editingDate)
    } catch (e: any) { showMsg(e.message) }
  }

  // ── Удалить строку смены (по id) — через API ──
  async function deleteRow(id: string) {
    try {
      await fetch('/api/reports/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'delete', id }) })
      await loadDraft(editingDate)
    } catch (e: any) { showMsg(e.message) }
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
      // День закрытия: прошлая смена (баннер) → дата ТОЙ смены; сегодняшняя → СЕГОДНЯ.
      // Строки НЕ шлём — они уже в блоке (наполнялись событиями). Закрытие только
      // переводит черновик в processing (сервер), не пересоздавая строки.
      const reportDay = editingDate || almatyTodayStr()
      await createDailyReport({ date: reportDay, comment: reportComment })
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
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#5f5952', marginBottom: 4, display: 'block', letterSpacing: '.04em' }

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
            style={{ padding: '10px 4px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: i <= activeIdx ? PRIMARY : '#f1efec', color: i <= activeIdx ? '#fff' : '#5f5952', opacity: updating === posId ? .6 : 1 }}>
            {b.label}
          </button>
        ))}
      </div>
    )
  }

  // ── Карточка позиции ──
  function PosCard({ pos, order }: { pos: any; order: Order }) {
    // Редактировать/добавлять можно только СВОИ позиции (resp==я), ещё не доставленные
    const editable = eqName(pos.resp, myName) && pos.status !== 'Доставлено'
    return (
      <div style={{ background: isPurchase(order) ? '#faf7fd' : '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderLeft: `4px solid ${isPurchase(order) ? '#7a3aaa' : '#2e8a5e'}`, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
        {editPosId === pos.id ? (
          <PositionEditor pos={pos} orderId={order.id}
            onEditing={e => { editingRef.current = e }}
            onSaved={m => { editingRef.current = false; setEditPosId(null); load(); showMsg(m) }}
            onCancel={() => { editingRef.current = false; setEditPosId(null) }} />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 16, flex: 1, display: 'flex', alignItems: 'center', gap: 7 }}><RalDot code={extractRal(pos.name1c || pos.oral)} />{pos.name1c || pos.oral}</div>
              <span style={{ fontWeight: 700, fontSize: 18, color: PRIMARY, marginLeft: 10 }}>{pos.qty} {pos.unit}</span>
            </div>
            <div style={{ fontSize: 14, color: '#5f5952', marginBottom: 4 }}>{order.from} → {order.to || '—'}</div>
            {/* Поставщик — редактируемый (может меняться в процессе) */}
            {editable && (supEditPos === pos.id ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <select autoFocus value={pos.supplier || ''} onChange={e => saveSupplier(order.id, pos.id, e.target.value)}
                  style={{ flex: 1, padding: '7px 8px', borderRadius: 8, border: '1.5px solid #e6e2dc', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                  <option value="">— поставщик —</option>
                  {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => setSupEditPos(null)} style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ) : (
              <div onClick={() => setSupEditPos(pos.id)} style={{ fontSize: 13, color: '#5f5952', marginBottom: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }} title="Изменить поставщика">
                🏭 {pos.supplier || <span style={{ color: '#b8b1a6' }}>поставщик не указан</span>} <span style={{ color: PRIMARY, fontWeight: 700 }}>✎</span>
              </div>
            ))}
            {order.comment && <div style={{ fontSize: 13, background: '#f8f6f3', borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>{order.comment.slice(0, 80)}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: PRIMARY, fontWeight: 600 }}>{order.id}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: isPurchase(order) ? '#f3eeff' : '#e8f5ee', color: isPurchase(order) ? '#7a3aaa' : '#2e8a5e' }}>{isPurchase(order) ? '🛒 ЗАКУП' : 'ПРОДАЖА'}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#6b645b' }}>{pos.id}</span>
              {pos.late && <span style={{ fontSize: 12, background: '#faeaea', color: '#b03020', padding: '1px 6px', borderRadius: 20, fontWeight: 600 }}>ПРОСРОЧ.</span>}
              <span style={{ fontSize: 12, background: pos.status === 'Доставлено' ? '#e8f5ee' : '#fff0ea', color: pos.status === 'Доставлено' ? '#2e8a5e' : '#c0532a', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{pos.status}</span>
              {editable && <button onClick={() => { editingRef.current = true; setEditPosId(pos.id) }} style={{ ...editBtn(false), marginLeft: 'auto' }}>Изменить</button>}
            </div>
            <StatusBtns cardId={order.id} posId={pos.id} posStatus={pos.status} posName={pos.name1c || pos.oral} fromWho={pos.supplier || order.from} toWho={order.to || ''} qty={pos.qty} />
            {/* Чат по заказу */}
            <button onClick={() => {
              const opening = chatOpenPos !== pos.id
              setChatOpenPos(opening ? pos.id : null)
              if (opening) fetch(`/api/orders/${order.id}/messages`).then(r => r.ok ? r.json() : []).then((d: any) => { const n = Array.isArray(d) ? d.length : 0; setMsgCount(prev => prev[order.id] === n ? prev : { ...prev, [order.id]: n }) }).catch(() => {})
            }} style={{ marginTop: 10, width: '100%', padding: '8px', border: 'none', borderRadius: 8, background: chatOpenPos === pos.id ? PRIMARY : '#f1efec', color: chatOpenPos === pos.id ? '#fff' : '#5f5952', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 600 }}>
              💬 Чат{msgCount[order.id] ? ` (${msgCount[order.id]})` : ''}
            </button>
            {chatOpenPos === pos.id && (
              <div style={{ marginTop: 10, paddingTop: 4, borderTop: '1px solid #f1efec' }}>
                <CardChat cardId={order.id} myId={user.id} height={300} />
              </div>
            )}
            {editable && (addingCardId === order.id ? (
              <AddPositionForm orderId={order.id} resp={myName} supplierOptions={suppliers}
                onEditing={e => { editingRef.current = e }}
                onAdded={m => { editingRef.current = false; setAddingCardId(null); load(); showMsg(m) }}
                onCancel={() => { editingRef.current = false; setAddingCardId(null) }} />
            ) : (
              <button onClick={() => { editingRef.current = true; setAddingCardId(order.id) }}
                style={{ marginTop: 10, width: '100%', padding: '9px', border: '1.5px dashed #d8d3cc', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 14, color: '#5f5952', fontFamily: 'inherit', fontWeight: 600 }}>
                ＋ Добавить позицию
              </button>
            ))}
          </>
        )}
      </div>
    )
  }

  if (sessionExpired) {
    return (
      <div style={{ background: '#dedbd6', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Golos Text', system-ui, sans-serif" }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 340, textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.15)' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Сессия устарела</div>
          <div style={{ color: '#5f5952', fontSize: 14, marginBottom: 18 }}>Войдите заново, чтобы продолжить.</div>
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="UKan" style={{ width: 42, height: 42, borderRadius: 10, display: 'block' }} />
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>U-Kan · Портал</div>
              <div style={{ color: '#8c857a', fontSize: 12 }}>{myName}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={load} style={{ background: DARK2, border: 'none', borderRadius: 7, padding: '6px 10px', color: loading ? '#d4613a' : '#cfc9c0', cursor: 'pointer', fontSize: 14, transition: 'color .3s' }}>
                {loading ? '⟳' : '⟳'}
              </button>
            <button onClick={logout} style={{ background: DARK2, border: 'none', borderRadius: 7, padding: '6px 12px', color: '#cfc9c0', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Выйти</button>
          </div>
        </div>
      </div>

      {/* Контент */}
      <div style={{ maxWidth: 432, margin: '0 auto', padding: '16px 66px 40px 14px' }}>

        {/* ── 📥 ВХОДЯЩИЕ ── */}
        {tab === 'in' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>💰 Продажа · ко мне</div>
            <DateFilter period={period} day={day} onChange={(p, d) => { setPeriod(p); setDay(d) }} />
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#5f5952' }}>Загрузка...</div>
              : posIn.length === 0
              ? <div style={{ background: '#fff', borderRadius: 14, padding: 36, textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 10 }}>✅</div><div style={{ color: '#5f5952' }}>Нет входящих позиций</div></div>
              : posIn.map(({ pos, order }) => <PosCard key={pos.id} pos={pos} order={order} />)
            }
          </div>
        )}

        {/* ── 🛒 ЗАКУПКИ ── */}
        {tab === 'buy' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: '#7a3aaa' }}>🛒 Закупки · на Центр-Склад</div>
            <div style={{ fontSize: 13, color: '#5f5952', marginBottom: 14 }}>Закупи товар и отметь позиции доставленными — товар придёт на Центр-Склад.</div>
            <DateFilter period={period} day={day} onChange={(p, d) => { setPeriod(p); setDay(d) }} />
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#5f5952' }}>Загрузка...</div>
              : posBuy.length === 0
              ? <div style={{ background: '#fff', borderRadius: 14, padding: 36, textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 10 }}>✅</div><div style={{ color: '#5f5952' }}>Нет активных закупов</div></div>
              : posBuy.map(({ pos, order }) => <PosCard key={`buy-${pos.id}`} pos={pos} order={order} />)
            }
          </div>
        )}

        {/* ── 📤 ИСХОДЯЩИЕ ── */}
        {tab === 'out' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>✅ Выполнено · доставлено мной</div>
            <DateFilter period={period} day={day} onChange={(p, d) => { setPeriod(p); setDay(d) }} />
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#5f5952' }}>Загрузка...</div>
              : posOut.length === 0
              ? <div style={{ background: '#fff', borderRadius: 14, padding: 36, textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 10 }}>📭</div><div style={{ color: '#5f5952' }}>Пока нет доставленных позиций</div></div>
              : posOut.map(({ pos, order }) => <PosCard key={`out-${pos.id}`} pos={pos} order={order} />)
            }
          </div>
        )}

        {/* ── ⚡ ИЗМЕНЕНИЯ ── */}
        {tab === 'changes' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>⚡ Изменения</div>
            <div style={{ fontSize: 13, color: '#5f5952', marginBottom: 14 }}>Кто-то добавил позицию или изменил число в ваших карточках. Откройте и подтвердите.</div>
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#5f5952' }}>Загрузка...</div>
              : posChanged.length === 0
              ? <div style={{ background: '#fff', borderRadius: 14, padding: 36, textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 10 }}>✅</div><div style={{ color: '#5f5952' }}>Нет новых изменений</div></div>
              : Array.from(new Set(posChanged.map(x => x.order.id))).map(cardId => {
                  const items = posChanged.filter(x => x.order.id === cardId)
                  const order = items[0].order
                  const note = notifications.find(n => n.cardId === cardId && !n.read)
                  return (
                    <div key={cardId} className="uk-blink" style={{ background: '#fff', border: '1.5px solid #f0c9b8', borderLeft: '4px solid #c1121c', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{order.id}</span>
                        <span style={{ fontSize: 12, color: '#5f5952' }}>от {order.from} · для {order.to || '—'}</span>
                        <button onClick={() => markCardSeen(cardId)} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', flexShrink: 0 }}>✓ Просмотрено</button>
                      </div>
                      {note && <div style={{ fontSize: 13, color: '#c0532a', marginBottom: 8, fontWeight: 600 }}>{note.text}</div>}
                      {items.map(({ pos, order }) => <PosCard key={`chg-${pos.id}`} pos={pos} order={order} />)}
                    </div>
                  )
                })
            }
          </div>
        )}

        {/* ── ➕ НОВЫЙ ── */}
        {tab === 'new' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>➕ Новый заказ</div>
            <div style={{ background: '#fff', borderRadius: 14, padding: 20 }}>
              {/* «От кого» не спрашиваем — источник = сам логист (from=myName в handleNew) */}
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
            <div style={{ fontSize: 13, color: '#5f5952', marginBottom: 16 }}>
              {new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })} · {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </div>

            {/* Индикатор: редактируем ПРОШЛУЮ смену */}
            {editingDate && !reportSent && (
              <div style={{ background: '#fff0ea', border: '1.5px solid #e6c9b8', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 14, color: '#c0532a', fontWeight: 600 }}>✎ Смена за {editingDate.split('-').reverse().join('.')}</span>
                <button onClick={backToToday} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e6c9b8', background: '#fff', color: '#c0532a', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>← К сегодняшней</button>
              </div>
            )}

            {/* Незакрытые смены прошлых дней — списком карточек над сегодняшним блоком.
                Смена ждёт закрытия сколько угодно; закрывается ПОД СВОИМ числом. */}
            {!editingDate && !reportSent && pastDrafts.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8a6f00', letterSpacing: '.04em', marginBottom: 8 }}>⚠ НЕЗАКРЫТЫЕ СМЕНЫ</div>
                {pastDrafts.map(pd => (
                  <div key={pd.id} style={{ background: '#fff', border: '1.5px solid #f0d98a', borderLeft: '4px solid #d4a017', borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#26231f' }}>Смена {fmtAlmatyDate(pd.date)}</div>
                      <div style={{ fontSize: 13, color: '#8a6f00', marginTop: 2 }}>не закрыта · {pd.rowCount} строк</div>
                    </div>
                    <button onClick={() => openPastDraft(pd.date)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', flexShrink: 0 }}>Открыть →</button>
                  </div>
                ))}
              </div>
            )}

            {reportSent ? (
              <div>
                <div style={{ background: '#e8f5ee', borderRadius: 14, padding: 24, textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: '#2e8a5e' }}>Отчёт отправлен!</div>
                  <div style={{ fontSize: 14, color: '#2e8a5e', marginTop: 4 }}>Ожидает подтверждения бухгалтера</div>
                </div>
                {/* Таблица отправленного */}
                <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                    <thead><tr style={{ background: '#f8f6f3' }}>
                      {['НАИМ.', 'ОТ КОГО', 'ШТ', 'КОММ.', 'КОМУ', 'ШТ', 'КОММ.', '№ НАКЛ.'].map(h => (
                        <th key={h} style={{ padding: '7px 8px', fontSize: 12, fontWeight: 700, color: '#5f5952', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {shiftRows.filter(r => r.name).map((r, i) => (
                        <tr key={r.id} style={{ borderTop: '1px solid #f1efec' }}>
                          <td style={{ padding: '7px 8px', fontSize: 13, fontWeight: 500 }}>{r.name}</td>
                          <td style={{ padding: '7px 8px', fontSize: 13 }}>{r.fromWho || '—'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 13 }}>{r.qtyIn || '—'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 13, color: '#5f5952' }}>{r.commentIn || '—'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 13 }}>{r.toWho || '—'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 13 }}>{r.qtyOut || '—'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 13, color: '#5f5952' }}>{r.commentOut || '—'}</td>
                          <td style={{ padding: '7px 8px', fontSize: 13, color: '#5f5952' }}>{r.invoiceNum || '—'}</td>
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
                      <div style={{ fontSize: 12, color: '#5f5952', marginTop: 2 }}>{label}</div>
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
                            <th key={hi} style={{ padding: '8px', fontSize: 12, fontWeight: 700, color: '#5f5952', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {shiftRows.filter(r => r.name).map(r => (
                            <tr key={r.id} style={{ borderTop: '1px solid #f1efec', background: r.auto ? '#fafff8' : '#fff' }}>
                              <td style={{ padding: '8px', fontSize: 13, fontWeight: 500 }}>{r.name}{r.auto && <span style={{ fontSize: 11, color: '#2e8a5e', marginLeft: 4 }}>авто</span>}</td>
                              <td style={{ padding: '8px', fontSize: 13 }}>{r.fromWho || '—'}</td>
                              <td style={{ padding: '8px', fontSize: 13 }}>{r.qtyIn || '—'}</td>
                              <td style={{ padding: '8px', fontSize: 13, color: '#5f5952' }}>{r.commentIn || '—'}</td>
                              <td style={{ padding: '8px', fontSize: 13 }}>{r.toWho || '—'}</td>
                              <td style={{ padding: '8px', fontSize: 13 }}>{r.qtyOut || '—'}</td>
                              <td style={{ padding: '8px', fontSize: 13, color: '#5f5952' }}>{r.commentOut || '—'}</td>
                              <td style={{ padding: '8px', fontSize: 13, color: '#5f5952' }}>{r.invoiceNum || '—'}</td>
                              <td style={{ padding: '8px' }}>
                                <div style={{ display: 'flex', gap: 3 }}>
                                  <button onClick={() => openEdit(r)} style={{ padding: '3px 6px', borderRadius: 5, border: '1.5px solid #e6e2dc', background: '#fff', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                                  <button onClick={() => deleteRow(r.id)} style={{ padding: '3px 6px', borderRadius: 5, border: '1.5px solid #faeaea', background: '#fff', cursor: 'pointer', fontSize: 12 }}>🗑</button>
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
                  style={{ width: '100%', padding: '11px', border: '2px dashed #d8d3cc', borderRadius: 10, background: 'none', cursor: 'pointer', fontSize: 14, color: '#5f5952', fontFamily: 'inherit', marginBottom: 12 }}>
                  + Добавить строку
                </button>

                {/* Дата (только показ — день закрытия вычисляется автоматически) и комментарий */}
                <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 }}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>ДЕНЬ СМЕНЫ</label>
                    <div style={{ ...inp, background: '#f8f6f3', color: '#5f5952', display: 'flex', alignItems: 'center' }}>
                      {(editingDate || almatyTodayStr()).split('-').reverse().join('.')}{editingDate ? ' · прошлая смена' : ' · сегодня'}
                    </div>
                  </div>
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

      {/* Плавающий чат-виджет */}
      <ChatWidget myId={user.id} bottomOffset={16} />

      {/* ── Плавающие круглые вкладки справа (вместо нижнего меню) ── */}
      <div style={{ position: 'fixed', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 100, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { key: 'in'      as Tab, icon: '💰', label: 'Продажа',   badge: posIn.length, blink: false },
          { key: 'buy'     as Tab, icon: '🛒', label: 'Закупки',   badge: posBuy.length, blink: false },
          { key: 'out'     as Tab, icon: '✅', label: 'Выполнено', badge: posOut.length, blink: false },
          { key: 'changes' as Tab, icon: '⚡', label: 'Изменения', badge: changedCount, blink: changedCount > 0 },
          { key: 'new'     as Tab, icon: '➕', label: 'Новый',     badge: 0, blink: false },
          { key: 'shift'   as Tab, icon: '📊', label: 'Смена',     badge: shiftRows.filter(r => r.name).length, blink: false },
        ].map(({ key, icon, label, badge, blink }) => {
          const active = tab === key
          return (
            <button key={key} onClick={() => setTab(key)} title={label} aria-label={label}
              className={blink ? 'uk-blink' : undefined}
              style={{
                position: 'relative', width: 48, height: 48, borderRadius: '50%', cursor: 'pointer',
                border: active ? 'none' : '1.5px solid #ece7e0',
                background: active ? PRIMARY : 'rgba(255,255,255,.92)',
                boxShadow: active ? '0 4px 14px rgba(212,97,58,.4)' : '0 2px 8px rgba(0,0,0,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, transition: 'transform .12s, background .12s', transform: active ? 'scale(1.08)' : 'none',
                backdropFilter: 'blur(4px)',
              }}>
              <span style={{ filter: active ? 'grayscale(0)' : 'none' }}>{icon}</span>
              {badge > 0 && <span style={{ position: 'absolute', top: -3, right: -3, background: blink ? '#c1121c' : (active ? '#fff' : PRIMARY), color: blink ? '#fff' : (active ? PRIMARY : '#fff'), fontSize: 11, fontWeight: 800, padding: '1px 5px', borderRadius: 10, minWidth: 16, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}>{badge}</span>}
            </button>
          )
        })}
      </div>

      <InstallPrompt />
    </div>
  )
}
