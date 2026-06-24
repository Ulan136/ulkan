'use client'
import { useState, useMemo, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Order, SettingsData } from '@/lib/types'
import { cardProgress, barColor, fmtDate } from '@/lib/display'
import { COLORS } from '@/lib/colors'

// ─── Типы ────────────────────────────────────────────────────────────────────

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

// ─── Мини-компоненты ─────────────────────────────────────────────────────────

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

// ─── Карточка внутри колонки ─────────────────────────────────────────────────

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
        transition: 'box-shadow .15s',
      }}
    >
      {/* Строка 1: ID + статус */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: COLORS.primary }}>{order.id}</span>
        <StatusDot status={order.status} />
        {order.isChanged && <span style={{ fontSize: 9, background: '#fff0ea', color: '#c0532a', padding: '1px 5px', borderRadius: 10, fontWeight: 700 }}>⚡</span>}
        {order.postponed && <span style={{ fontSize: 9, background: '#eef2ff', color: '#4a5aaa', padding: '1px 5px', borderRadius: 10, fontWeight: 700 }}>откл.</span>}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#8a847c' }}>{fmtDate(order.createdAt)}</span>
      </div>
      {/* Строка 2: маршрут */}
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {order.from}{order.to ? ` → ${order.to}` : ''}
      </div>
      {/* Прогресс бар */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1 }}><ProgressBar pct={pct} /></div>
        <span style={{ fontSize: 10, fontWeight: 700, color: barColor(pct), flexShrink: 0 }}>{pct}%</span>
      </div>
      {/* Срок если есть */}
      {order.deadline && (
        <div style={{ fontSize: 10, color: '#8a847c', marginTop: 4 }}>
          срок {fmtDate(order.deadline)}
        </div>
      )}
    </div>
  )
}

// ─── Sortable карточка ────────────────────────────────────────────────────────

function SortableCard({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: order.id,
    data: { type: 'card', order },
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard order={order} onOpen={onOpen} />
    </div>
  )
}

// ─── Sortable колонка ─────────────────────────────────────────────────────────

function SortableColumn({
  column, onOpen, group,
}: {
  column: Column
  onOpen: (order: Order) => void
  group: FilterGroup
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column' },
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? .5 : 1,
    flexShrink: 0,
    width: 280,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100vh - 220px)',
  }

  const cardIds = column.orders.map(o => o.id)

  return (
    <div ref={setNodeRef} style={style}>
      {/* Заголовок колонки — за него тащим */}
      <div
        {...attributes}
        {...listeners}
        style={{ padding: '10px 12px', background: COLORS.sidebar.bg, borderRadius: '10px 10px 0 0', cursor: 'grab', display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none' }}
      >
        <span style={{ fontWeight: 700, fontSize: 13, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{column.title}</span>
        <span style={{ background: COLORS.primary, color: '#fff', fontSize: 11, padding: '1px 7px', borderRadius: 20, fontWeight: 700, flexShrink: 0 }}>{column.orders.length}</span>
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
          {/* Общий прогресс */}
          {column.specItems.length > 1 && (() => {
            const totalNeeded = column.specItems.reduce((s, i) => s + i.needed, 0)
            const totalCollected = column.specItems.reduce((s, i) => s + i.collected, 0)
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

      {/* Карточки (скроллятся) */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f8f6f3', border: '1px solid #e6e2dc', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '10px 8px', minHeight: 80 }}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {column.orders.length === 0
            ? <div style={{ textAlign: 'center', padding: '20px 0', color: '#b8b1a6', fontSize: 12 }}>Пусто</div>
            : column.orders.map(o => (
              <SortableCard key={o.id} order={o} onOpen={() => onOpen(o)} />
            ))
          }
        </SortableContext>
      </div>
    </div>
  )
}

// ─── Главный компонент FilterScreen ──────────────────────────────────────────

export default function FilterScreen({ orders, settings, onOpen }: Props) {
  const [group, setGroup] = useState<FilterGroup>('clients')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [colOrder, setColOrder] = useState<string[]>([])
  const [cardOverrides, setCardOverrides] = useState<Record<string, string>>({}) // cardId → colId
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'card' | 'column' | null>(null)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  // Фильтрация по статусу
  const filteredOrders = useMemo(() => {
    const base = orders.filter(o => o.screen !== 'archive' && !o.isDraft && !o.isCancelled)
    if (statusFilter === 'inwork') return base.filter(o => o.screen === 'outgoing' || o.screen === 'reception')
    if (statusFilter === 'delivered') return base.filter(o => o.status === 'Доставлено' || o.toacc)
    return base
  }, [orders, statusFilter])

  // Строим колонки по группировке
  const baseColumns = useMemo<Column[]>(() => {
    if (!settings) return []

    if (group === 'clients') {
      const clientNames = [...new Set(filteredOrders.map(o => o.from))]
      return clientNames.map(name => ({
        id: `client:${name}`,
        title: name,
        orders: filteredOrders.filter(o => o.from === name),
      }))
    }

    if (group === 'suppliers') {
      return settings.suppliers.map(sup => ({
        id: `sup:${sup.id}`,
        title: sup.name,
        orders: filteredOrders.filter(o => o.positions.some(p => p.supplier === sup.name)),
      })).filter(c => c.orders.length > 0)
    }

    if (group === 'projects') {
      return settings.projects.filter(p => p.status === 'active').map(prj => ({
        id: `prj:${prj.id}`,
        title: prj.name,
        orders: filteredOrders.filter(o => o.projectId === prj.id),
      }))
    }

    if (group === 'specprojects') {
      return settings.specProjects.filter(sp => sp.status === 'active').map(sp => {
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
  }, [filteredOrders, group, settings])

  // Применяем пользовательский порядок колонок
  const columns = useMemo<Column[]>(() => {
    // Применяем cardOverrides (перенос карточек между колонками)
    const withOverrides = baseColumns.map(col => ({
      ...col,
      orders: [
        ...col.orders.filter(o => !cardOverrides[o.id]),
        ...baseColumns.flatMap(c => c.orders).filter(o => cardOverrides[o.id] === col.id),
      ].filter((o, i, arr) => arr.findIndex(x => x.id === o.id) === i),
    }))

    // Применяем порядок колонок
    if (colOrder.length === 0) return withOverrides
    const ordered: Column[] = []
    colOrder.forEach(id => {
      const col = withOverrides.find(c => c.id === id)
      if (col) ordered.push(col)
    })
    withOverrides.forEach(col => {
      if (!ordered.find(c => c.id === col.id)) ordered.push(col)
    })
    return ordered
  }, [baseColumns, colOrder, cardOverrides])

  const columnIds = columns.map(c => c.id)
  const totalCards = columns.reduce((s, c) => s + c.orders.length, 0)

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    setActiveId(String(active.id))
    const data = active.data.current
    if (data?.type === 'column') {
      setActiveType('column')
      setActiveOrder(null)
    } else {
      setActiveType('card')
      setActiveOrder(data?.order || null)
    }
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeData = active.data.current
    if (activeData?.type === 'column') return // колонки обрабатываем в dragEnd

    // Карточка над другой колонкой или карточкой
    const cardId = String(active.id)
    const overId = String(over.id)

    // Найти колонку назначения
    let targetColId: string | null = null
    for (const col of columns) {
      if (col.id === overId) { targetColId = col.id; break }
      if (col.orders.some(o => o.id === overId)) { targetColId = col.id; break }
    }
    if (targetColId) {
      setCardOverrides(prev => ({ ...prev, [cardId]: targetColId! }))
    }
  }, [columns])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null); setActiveType(null); setActiveOrder(null)
    if (!over || active.id === over.id) return

    const activeData = active.data.current
    if (activeData?.type === 'column') {
      // Переставляем колонки
      const currentIds = columns.map(c => c.id)
      const oldIdx = currentIds.indexOf(String(active.id))
      const newIdx = currentIds.indexOf(String(over.id))
      if (oldIdx !== -1 && newIdx !== -1) {
        setColOrder(arrayMove(currentIds, oldIdx, newIdx))
      }
    }
  }, [columns])

  const GROUP_BTNS: Array<[FilterGroup, string]> = [
    ['clients', 'По заказчикам'],
    ['suppliers', 'По поставщикам'],
    ['projects', 'По проектам'],
    ['specprojects', 'По СпецПроектам'],
  ]
  const STATUS_BTNS: Array<[FilterStatus, string]> = [
    ['inwork', 'В работе'],
    ['delivered', 'Доставлено'],
    ['all', 'Все'],
  ]

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
      <div style={{ flexShrink: 0, paddingBottom: 14 }}>
        {/* Группировка */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#8a847c', fontWeight: 600, marginRight: 4 }}>Группировка:</span>
          {GROUP_BTNS.map(([key, label]) => (
            <button key={key} onClick={() => { setGroup(key); setColOrder([]); setCardOverrides({}) }} style={pilBtn(group === key)}>{label}</button>
          ))}
          <div style={{ width: 1, height: 20, background: '#e6e2dc', margin: '0 4px' }} />
          <span style={{ fontSize: 12, color: '#8a847c', fontWeight: 600, marginRight: 4 }}>Статус:</span>
          {STATUS_BTNS.map(([key, label]) => (
            <button key={key} onClick={() => setStatusFilter(key)} style={pilBtn(statusFilter === key)}>{label}</button>
          ))}
          <span style={{ fontSize: 12, color: '#8a847c', marginLeft: 'auto' }}>
            {totalCards} карточек в {columns.length} колонках
          </span>
        </div>
      </div>

      {/* ── Канбан ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          <div
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              overflowY: 'hidden',
              flex: 1,
              paddingBottom: 16,
              alignItems: 'flex-start',
            }}
          >
            {columns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#8a847c', fontSize: 14, width: '100%' }}>
                {settings ? 'Нет карточек для отображения' : 'Загрузка...'}
              </div>
            ) : (
              columns.map(col => (
                <SortableColumn
                  key={col.id}
                  column={col}
                  onOpen={onOpen}
                  group={group}
                />
              ))
            )}
          </div>
        </SortableContext>

        {/* DragOverlay — что показываем пока тащим */}
        <DragOverlay>
          {activeType === 'card' && activeOrder && (
            <KanbanCard order={activeOrder} onOpen={() => {}} isDragging />
          )}
          {activeType === 'column' && activeId && (() => {
            const col = columns.find(c => c.id === activeId)
            return col ? (
              <div style={{ width: 280, background: COLORS.sidebar.bg, borderRadius: 10, padding: '10px 12px', opacity: .9 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{col.title}</span>
              </div>
            ) : null
          })()}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
