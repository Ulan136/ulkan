import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cardProgress, orderInclude } from '@/lib/orderMetrics'
import { POS_STATUS, CARD_STATUS } from '@/lib/orderStatus'

// Публичная стадия трекинга (1..5) по статусу заказа. Ключи — из orderStatus.
// К учёту/Бухгалтерия/Архив для клиента = завершено (стадия 5 «Доставлено»),
// а не «Заявка». Отменённый заказ обрабатывается отдельно (cancelled в ответе).
const STAGES: Record<string, number> = {
  [CARD_STATUS.waiting]: 1,          // В ожидании
  'Новая заявка': 1,                 // legacy-статус старых заявок с трекинга
  [CARD_STATUS.accepted]: 2,         // Принят
  [CARD_STATUS.processing]: 2,       // В обработке
  [CARD_STATUS.working]: 3,          // В работе
  [POS_STATUS.readyToShip]: 4,       // Готово к отгрузке
  [POS_STATUS.inTransit]: 4,         // В пути
  [POS_STATUS.acceptedByBranch]: 5,  // Принято филиалом
  [CARD_STATUS.delivered]: 5,        // Доставлено
  [CARD_STATUS.toAccount]: 5,        // К учёту → для клиента завершено
  [CARD_STATUS.bookkeeping]: 5,      // Бухгалтерия → для клиента завершено
  [CARD_STATUS.archive]: 5,          // Архив
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      ...orderInclude,
      history: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })

  const stage = STAGES[order.status] || 1
  const pct = cardProgress(order)

  // Индикатор изготовления: сколько позиций ещё на первом плече (у филиала)
  const leg1Count = order.positions.filter(p => p.leg === 1).length
  const legStage: string | null = leg1Count > 0 ? `Изготовление: ${leg1Count} поз.` : null

  const details: Array<{ k: string; v: string }> = [
    { k: 'Номер', v: order.id },
    { k: 'Заказчик', v: order.from },
    { k: 'Получатель', v: order.to || 'не распределено' },
    { k: 'Позиций', v: String(order.positions.length) },
  ]
  if (order.deadline) details.push({ k: 'Срок', v: new Date(order.deadline).toLocaleDateString('ru-RU') })

  return NextResponse.json({
    id: order.id,
    from: order.from,
    to: order.to,
    status: order.status,
    stage,
    cancelled: order.isCancelled,
    cancelReason: order.cancelReason || '',
    progress: pct,
    legStage,
    createdAt: order.createdAt,
    delivered: order.delivered,
    positions: order.positions.map(p => ({ id: p.id, name: p.name1c || p.oral, qty: p.qty, unit: p.unit, status: p.status })),
    history: order.history.map(h => ({ action: h.action, time: h.createdAt.toISOString() })),
    details,
  })
}
