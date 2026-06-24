'use client'
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners, DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable,
  horizontalListSortingStrategy, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Order, SettingsData } from '@/lib/types'
import { cardProgress, barColor, fmtDate } from '@/lib/display'
import { COLORS } from '@/lib/colors'

type FilterGroup = 'clients' | 'suppliers' | 'projects' | 'specprojects'
type FilterStatus = 'inwork' | 'delivered' | 'all'

interface Column {
  id: string
  title: string
  orders: Order[]
  specItems?: Array<{ name: string; unit: string; needed: number; collected: number; pct: number }>
}

interface Props {
  orders: Order[]
  settings: SettingsData | null
  onOpen: (order: Order) => void
}

// ─── Прогресс бар ────────────────────────────────────────────────────────────
function ProgressBar({ pct, height = 4 }: { pct: number; height?: number }) {
  return (
    <div style={{ height, background: '#f1efec', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: barColor(pct), borderRadius: 4, transition: 'width .3s' }} />
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    'В ожидании': '#4a5aaa', 'Новая заявка': '#4a5aaa',
    'Принят': '#c0532a', 'В обработке': '#c0532a', 'В работе': '#c0532a',
    'Готово к отгрузке': '#8a6f00', 'В пути': '#8a6f00',
    'Доставлено': '#2e8a5e', 'К учёту': '#2e8a5e',
  }
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: map[status] || '#b8b1a6', display: 'inline-block', flexShrink: 0 }} />
}

// ─── Раскрывающийся список с поиском ─────────────────────────────────────────
function MultiSelectDropdown({
  label, options, selected, onToggle, onClose,
}: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (val: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))

  return (
    <div ref={ref} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: '#fff', borderRadius: 10, boxShadow: '0 4px 24px rgba(0,0,0,.14)', width: 260, border: '1.5px solid #e6e2dc', marginTop: 4 }}>
      {/* Поиск */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1efec' }}>
        <input
          ref={inputRef}
          style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1.5px solid #e6e2dc', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
          placeholder={`Поиск по ${label.toLowerCase()}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {/* Список */}
      <div style={{ maxHeight: 240, overflowY: 'auto', padding: '6px 0' }}>
        {filtered.length === 0
          ? <div style={{ padding: '10px 14px', fontSize: 13, color: '#8a847c' }}>Ничего не найдено</div>
          : filtered.map(opt => {
            const active = selected.includes(opt)
            return (
              <div
                key={opt}
                onClick={() => { onToggle(opt); setSearch('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer', background: active ? '#fff8f5' : 'transparent', transition: 'background .1s' }}
              >
                <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${active ? COLORS.primary : '#d8d3cc'}`, background: active ? COLORS.primary : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                  {active && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{opt}</span>
              </div>
            )
          })
        }
      </div>
      {/* Выбранные теги внизу */}
      {selected.length > 0 && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #f1efec', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {selected.map(s => (
            <span key={s} onClick={() => onToggle(s)} style={{ fontSize: 11, background: '#fff0ea', color: COLORS.primary, padding: '2px 8px', borderRadius: 20, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              {s} <span style={{ opacity: .6 }}>✕</span>
            </span>
          ))}
          <button onClick={() => { selected.forEach(s => onToggle(s)) }} style={{ fontSize: 11, color: '#8a847c', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Сбросить</button>
        </div>
      )}
    </div>
  )
}

// ─── Кнопка группировки с дропдауном ─────────────────────────────────────────
function GroupBtn({
  label, active, options, selected, onToggle,
}: {
  label: string; active: boolean
  options: string[]; selected: string[]
  onToggle: (val: string) => void
}) {
  const [open, setOpen] = useState(false)
  const hasOptions = options.length > 0

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => hasOptions && setOpen(p => !p)}
        style={{
          padding: '5px 12px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 12,
          cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
          background: active ? COLORS.primary : '#fff',
          color: active ? '#fff' : '#8a847c',
          boxShadow: '0 0 0 1.5px #e6e2dc',
        }}
      >
        {label}
        {selected.length > 0 && (
          <span style={{ background: active ? 'rgba(255,255,255,.3)' : COLORS.primary, color: '#fff', fontSize: 10, padding: '0px 5px', borderRadius: 10, fontWeight: 700 }}>
            {selected.length}
          </span>
        )}
        {hasOptions && <span style={{ fontSize: 10, opacity: .6 }}>{open ? '▲' : '▼'}</span>}
      </button>
      {open && (
        <MultiSelectDropdown
          label={label}
          options={options}
          selected={selected}
          onToggle={val => { onToggle(val) }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Канбан карточка ──────────────────────────────────────────────────────────
function KanbanCard({ order, onOpen, isDragging = false }: { order: Order; onOpen: () => void; isDragging?: boolean }) {
  const pct = cardProgress(order)
  return (
    <div
      onClick={onOpen}
      style={{
        background: '#fff', borderRadius: 10, padding: '10px 12px',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,.18)' : '0 0 0 1.5px #e6e2dc',
        cursor: 'grab', marginBottom: 8, opacity: isDragging ? .85 : 1,
        transform: isDragging ? 'rotate(2deg)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: COLORS.primary }}>{order.id}</span>
        <StatusDot status={order.status} />
        {order.isChanged && <span style={{ fontSize: 9, background: '#fff0ea', color: '#c0532a', padding: '1px 5px', borderRadius: 10, fontWeight: 700 }}>⚡</span>}
        {order.postponed && <span style={{ fontSize: 9, background: '#eef2ff', color: '#4a5aaa', padding: '1px 5px', borderRadius: 10, fontWeight: 700 }}>откл.</span>}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#8a847c' }}>{fmtDate(order.createdAt)}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {order.from}{order.to ? ` → ${order.to}` : ''}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1 }}><ProgressBar pct={pct} /></div>
        <span style={{ fontSize: 10, fontWeight: 700, color: barColor(pct), flexShrink: 0 }}>{pct}%</span>
      </div>
      {order.deadline && <div style={{ fontSize: 10, color: '#8a847c', marginTop: 4 }}>срок {fmtDate(order.deadline)}</div>}
    </div>
  )
}

// ─── Sortable карточка ────────────────────────────────────────────────────────
function SortableCard({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: order.id, data: { type: 'card', order },
  })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }} {...attributes} {...listeners}>
      <KanbanCard order={order} onOpen={onOpen} />
    </div>
  )
}

// ─── Sortable колонка ─────────────────────────────────────────────────────────
function SortableColumn({ column, onOpen, group, onHide }: {
  column: Column; onOpen: (o: Order) => void; group: FilterGroup; onHide: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id, data: { type: 'column' },
  })

  const cardIds = column.orders.map(o => o.id)

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .5 : 1, flexShrink: 0, width: 280, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)' }}>
      {/* Заголовок — тащим за него */}
      <div
        {...attributes} {...listeners}
        style={{ padding: '10px 12px', background: COLORS.sidebar.bg, borderRadius: '10px 10px 0 0', cursor: 'grab', display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none' }}
      >
        <span style={{ fontWeight: 700, fontSize: 13, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{column.title}</span>
        <span style={{ background: COLORS.primary, color: '#fff', fontSize: 11, padding: '1px 7px', borderRadius: 20, fontWeight: 700, flexShrink: 0 }}>{column.orders.length}</span>
        {/* Кнопка скрыть колонку */}
        <button
          onClick={e => { e.stopPropagation(); onHide() }}
          style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 6, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 14, flexShrink: 0, lineHeight: 1 }}
        >✕</button>
      </div>

      {/* Блок сметы для СпецПроектов */}
      {group === 'specprojects' && column.specItems && column.specItems.length > 0 && (
        <div style={{ background: '#faf8f6', border: '1px solid #e6e2dc', borderTop: 'none', padding: '10px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#8a847c', marginBottom: 6, letterSpacing: '.04em' }}>СМЕТА vs СОБРАНО</div>
          {column.specItems.map((item, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{item.name}</span>
                <span style={{ fontSize: 10, color: '#8a847c', flexShrink: 0, marginLeft: 4 }}>{item.collected}/{item.needed} {item.unit}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ flex: 1 }}><ProgressBar pct={item.pct} height={3} /></div>
                <span style={{ fontSize: 10, fontWeight: 700, color: barColor(item.pct), width: 28, textAlign: 'right', flexShrink: 0 }}>{item.pct}%</span>
              </div>
            </div>
          ))}
          {column.specItems.length > 1 && (() => {
            const totalNeeded = column.specItems!.reduce((s, i) => s + i.needed, 0)
            const totalCollected = column.specItems!.reduce((s, i) => s + i.collected, 0)
            const totalPct = totalNeeded > 0 ? Math.round(Math.min(totalCollected / totalNeeded * 100, 100)) : 0
            return (
              <div style={{ paddingTop: 6, borderTop: '1px solid #e6e2dc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: '#8a847c', fontWeight: 600 }}>Общий прогресс</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: barColor(totalPct) }}>{totalPct}%</span>
                </div>
                <ProgressBar pct={totalPct} height={5} />
              </div>
            )
          })()}
        </div>
      )}

      {/* Карточки */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f8f6f3', border: '1px solid #e6e2dc', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '10px 8px', minHeight: 80 }}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {column.orders.length === 0
            ? <div style={{ textAlign: 'center', padding: '20px 0', color: '#b8b1a6', fontSize: 12 }}>Пусто</div>
            : column.orders.map(o => <SortableCard key={o.id} order={o} onOpen={() => onOpen(o)} />)
          }
        </SortableContext>
      </div>
    </div>
  )
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function FilterScreen({ orders, settings, onOpen }: Props) {
  const [group, setGroup] = useState<FilterGroup>('clients')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')

  // Выбранные фильтры — сохраняются при смене группировки
  const [selClients, setSelClients] = useState<string[]>([])
  const [selSuppliers, setSelSuppliers] = useState<string[]>([])
  const [selProjects, setSelProjects] = useState<string[]>([])
  const [selSpecs, setSelSpecs] = useState<string[]>([])

  // Скрытые колонки — сохраняются при смене группировки
  const [hiddenCols, setHiddenCols] = useState<Record<FilterGroup, string[]>>({ clients: [], suppliers: [], projects: [], specprojects: [] })

  const [colOrder, setColOrder] = useState<Record<FilterGroup, string[]>>({ clients: [], suppliers: [], projects: [], specprojects: [] })
  const [cardOverrides, setCardOverrides] = useState<Record<string, string>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'card' | 'column' | null>(null)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // Toggle helpers
  function toggle(val: string, arr: string[], set: (v: string[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  // Все доступные варианты
  const allClients = useMemo(() => [...new Set(orders.filter(o => !o.isCancelled).map(o => o.from))].sort(), [orders])
  const allSuppliers = useMemo(() => settings?.suppliers.map(s => s.name) || [], [settings])
  const allProjects = useMemo(() => settings?.projects.filter(p => p.status === 'active').map(p => p.name) || [], [settings])
  const allSpecs = useMemo(() => settings?.specProjects.filter(s => s.status === 'active').map(s => s.name) || [], [settings])

  // Фильтрованные заказы
  const filteredOrders = useMemo(() => {
    const base = orders.filter(o => o.screen !== 'archive' && !o.isDraft && !o.isCancelled)
    if (statusFilter === 'inwork') return base.filter(o => o.screen === 'outgoing' || o.screen === 'reception')
    if (statusFilter === 'delivered') return base.filter(o => o.status === 'Доставлено' || o.toacc)
    return base
  }, [orders, statusFilter])

  // Базовые колонки
  const baseColumns = useMemo<Column[]>(() => {
    if (!settings) return []
    const hidden = hiddenCols[group]

    if (group === 'clients') {
      const clients = selClients.length > 0 ? selClients : allClients
      return clients
        .filter(name => !hidden.includes(`client:${name}`))
        .map(name => ({ id: `client:${name}`, title: name, orders: filteredOrders.filter(o => o.from === name) }))
    }
    if (group === 'suppliers') {
      const sups = selSuppliers.length > 0
        ? settings.suppliers.filter(s => selSuppliers.includes(s.name))
        : settings.suppliers
      return sups
        .filter(s => !hidden.includes(`sup:${s.id}`))
        .map(s => ({ id: `sup:${s.id}`, title: s.name, orders: filteredOrders.filter(o => o.positions.some(p => p.supplier === s.name)) }))
        .filter(c => c.orders.length > 0 || selSuppliers.includes(c.title))
    }
    if (group === 'projects') {
      const projs = selProjects.length > 0
        ? settings.projects.filter(p => selProjects.includes(p.name) && p.status === 'active')
        : settings.projects.filter(p => p.status === 'active')
      return projs
        .filter(p => !hidden.includes(`prj:${p.id}`))
        .map(p => ({ id: `prj:${p.id}`, title: p.name, orders: filteredOrders.filter(o => o.projectId === p.id) }))
    }
    if (group === 'specprojects') {
      const specs = selSpecs.length > 0
        ? settings.specProjects.filter(s => selSpecs.includes(s.name) && s.status === 'active')
        : settings.specProjects.filter(s => s.status === 'active')
      return specs
        .filter(sp => !hidden.includes(`sp:${sp.id}`))
        .map(sp => {
          const spOrders = filteredOrders.filter(o => o.specProjectId === sp.id)
          const specItems = sp.items.map(item => {
            const collected = spOrders.reduce((s, o) =>
              s + o.positions.filter(p => p.name1c === item.name || p.oral === item.name).reduce((ps, p) => ps + p.qty, 0), 0)
            const pct = item.qty > 0 ? Math.round(Math.min(collected / item.qty * 100, 100)) : 0
            return { name: item.name, unit: item.unit, needed: item.qty, collected, pct }
          })
          return { id: `sp:${sp.id}`, title: sp.name, orders: spOrders, specItems }
        })
    }
    return []
  }, [filteredOrders, group, settings, selClients, selSuppliers, selProjects, selSpecs, hiddenCols, allClients])

  // Применяем порядок колонок
  const columns = useMemo<Column[]>(() => {
    const withOverrides = baseColumns.map(col => ({
      ...col,
      orders: [
        ...col.orders.filter(o => !cardOverrides[o.id]),
        ...baseColumns.flatMap(c => c.orders).filter(o => cardOverrides[o.id] === col.id),
      ].filter((o, i, arr) => arr.findIndex(x => x.id === o.id) === i),
    }))
    const curOrder = colOrder[group]
    if (!curOrder || curOrder.length === 0) return withOverrides
    const ordered: Column[] = []
    curOrder.forEach(id => { const col = withOverrides.find(c => c.id === id); if (col) ordered.push(col) })
    withOverrides.forEach(col => { if (!ordered.find(c => c.id === col.id)) ordered.push(col) })
    return ordered
  }, [baseColumns, colOrder, cardOverrides, group])

  const columnIds = columns.map(c => c.id)
  const totalCards = columns.reduce((s, c) => s + c.orders.length, 0)

  function hideColumn(colId: string) {
    setHiddenCols(prev => ({ ...prev, [group]: [...(prev[group] || []), colId] }))
  }

  // DnD
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
    const data = event.active.data.current
    setActiveType(data?.type === 'column' ? 'column' : 'card')
    setActiveOrder(data?.order || null)
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    if (active.data.current?.type === 'column') return
    const cardId = String(active.id)
    const overId = String(over.id)
    let targetColId: string | null = null
    for (const col of columns) {
      if (col.id === overId) { targetColId = col.id; break }
      if (col.orders.some(o => o.id === overId)) { targetColId = col.id; break }
    }
    if (targetColId) setCardOverrides(prev => ({ ...prev, [cardId]: targetColId! }))
  }, [columns])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null); setActiveType(null); setActiveOrder(null)
    if (!over || active.id === over.id) return
    if (active.data.current?.type === 'column') {
      const ids = columns.map(c => c.id)
      const oldIdx = ids.indexOf(String(active.id))
      const newIdx = ids.indexOf(String(over.id))
      if (oldIdx !== -1 && newIdx !== -1) {
        setColOrder(prev => ({ ...prev, [group]: arrayMove(ids, oldIdx, newIdx) }))
      }
    }
  }, [columns, group])

  // Восстановить скрытые колонки
  const hiddenCount = hiddenCols[group]?.length || 0

  const pilBtn = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 12,
    cursor: 'pointer', fontFamily: 'inherit',
    background: active ? COLORS.primary : '#fff',
    color: active ? '#fff' : '#8a847c',
    boxShadow: '0 0 0 1.5px #e6e2dc',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>

      {/* ── Управление ── */}
      <div style={{ flexShrink: 0, paddingBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>

          <span style={{ fontSize: 12, color: '#8a847c', fontWeight: 600 }}>Группировка:</span>

          {/* По заказчикам */}
          <GroupBtn
            label="По заказчикам"
            active={group === 'clients'}
            options={allClients}
            selected={selClients}
            onToggle={val => { setGroup('clients'); toggle(val, selClients, setSelClients) }}
          />

          {/* По поставщикам */}
          <GroupBtn
            label="По поставщикам"
            active={group === 'suppliers'}
            options={allSuppliers}
            selected={selSuppliers}
            onToggle={val => { setGroup('suppliers'); toggle(val, selSuppliers, setSelSuppliers) }}
          />

          {/* По проектам */}
          <GroupBtn
            label="По проектам"
            active={group === 'projects'}
            options={allProjects}
            selected={selProjects}
            onToggle={val => { setGroup('projects'); toggle(val, selProjects, setSelProjects) }}
          />

          {/* По СпецПроектам */}
          <GroupBtn
            label="По СпецПроектам"
            active={group === 'specprojects'}
            options={allSpecs}
            selected={selSpecs}
            onToggle={val => { setGroup('specprojects'); toggle(val, selSpecs, setSelSpecs) }}
          />

          <div style={{ width: 1, height: 20, background: '#e6e2dc', margin: '0 4px' }} />
          <span style={{ fontSize: 12, color: '#8a847c', fontWeight: 600 }}>Статус:</span>

          {([['inwork', 'В работе'], ['delivered', 'Доставлено'], ['all', 'Все']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setStatusFilter(key)} style={pilBtn(statusFilter === key)}>{label}</button>
          ))}

          {/* Восстановить скрытые */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setHiddenCols(prev => ({ ...prev, [group]: [] }))}
              style={{ padding: '5px 12px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: '#fdf8e1', color: '#8a6f00', boxShadow: '0 0 0 1.5px #f0dfa0' }}
            >
              ↺ Показать скрытые ({hiddenCount})
            </button>
          )}

          <span style={{ fontSize: 12, color: '#8a847c', marginLeft: 'auto' }}>
            {totalCards} карточек в {columns.length} колонках
          </span>
        </div>
      </div>

      {/* ── Канбан ── */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', overflowY: 'hidden', flex: 1, paddingBottom: 16, alignItems: 'flex-start' }}>
            {columns.length === 0
              ? <div style={{ textAlign: 'center', padding: '40px 0', color: '#8a847c', fontSize: 14, width: '100%' }}>
                  {settings ? 'Нет карточек. Выберите фильтр или добавьте карточки.' : 'Загрузка...'}
                </div>
              : columns.map(col => (
                <SortableColumn key={col.id} column={col} onOpen={onOpen} group={group} onHide={() => hideColumn(col.id)} />
              ))
            }
          </div>
        </SortableContext>

        <DragOverlay>
          {activeType === 'card' && activeOrder && <KanbanCard order={activeOrder} onOpen={() => {}} isDragging />}
          {activeType === 'column' && activeId && (() => {
            const col = columns.find(c => c.id === activeId)
            return col ? <div style={{ width: 280, background: COLORS.sidebar.bg, borderRadius: 10, padding: '10px 12px', opacity: .9 }}><span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{col.title}</span></div> : null
          })()}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
