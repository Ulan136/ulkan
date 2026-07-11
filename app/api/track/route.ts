import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cardProgress, orderInclude } from '@/lib/orderMetrics'
import { isForwardedToLogist } from '@/services/legDetection'

const STAGES: Record<string, number> = {
  'В ожидании': 1, 'Новая заявка': 1, 'Принят': 2, 'В обработке': 2,
  'В работе': 3, 'Готово к отгрузке': 4, 'В пути': 4,
  'Принято филиалом': 5, 'Доставлено': 5, 'Архив': 5,
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

  // Индикатор плеча для двухплечевых заказов (чтобы откат % не выглядел сбоем)
  let legStage: string | null = null
  if (order.leg === 1) {
    legStage = 'Этап 1 из 2 · Изготовление'
  } else if (await isForwardedToLogist(order)) {
    legStage = 'Этап 2 из 2 · Доставка'
  }

  const details: Array<{ k: string; v: string }> = [
    { k: 'Номер', v: order.id },
    { k: 'Заказчик', v: order.from },
    { k: 'Получатель', v: order.to || '—' },
    { k: 'Позиций', v: String(order.positions.length) },
  ]
  if (order.deadline) details.push({ k: 'Срок', v: new Date(order.deadline).toLocaleDateString('ru-RU') })

  return NextResponse.json({
    id: order.id,
    from: order.from,
    to: order.to,
    status: order.status,
    stage,
    progress: pct,
    legStage,
    createdAt: order.createdAt,
    delivered: order.delivered,
    positions: order.positions.map(p => ({ name: p.name1c || p.oral, qty: p.qty, unit: p.unit, status: p.status })),
    history: order.history.map(h => ({ action: h.action, time: h.createdAt.toISOString() })),
    details,
  })
}
