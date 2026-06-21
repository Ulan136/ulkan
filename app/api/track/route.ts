import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cardProgress } from '@/lib/display'

const STAGES: Record<string, number> = {
  'В ожидании': 1, 'Новая заявка': 1, 'Черновик': 1,
  'Принят': 2, 'В обработке': 2,
  'В работе': 3, 'Готово к отгрузке': 4, 'В пути': 4,
  'Доставлено': 5, 'К учёту': 5, 'Бухгалтерия': 5, 'Архив': 5,
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      positions: true,
      history: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })
  if (!order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })

  const progress = cardProgress(order as never)

  return NextResponse.json({
    id: order.id,
    from: order.from,
    to: order.to,
    status: order.status,
    stage: STAGES[order.status] || 1,
    progress,
    createdAt: order.createdAt,
    delivered: order.delivered,
    positions: order.positions.map(p => ({
      name: p.name1c || p.oral || '—',
      qty: p.qty,
      unit: p.unit,
      status: p.status,
    })),
    history: order.history.map(h => ({ action: h.action, time: h.createdAt })),
    details: [
      { k: 'Номер', v: order.id },
      { k: 'Заказчик', v: order.from },
      { k: 'Получатель', v: order.to || '—' },
      { k: 'Позиций', v: String(order.positions.length) },
    ],
  })
}