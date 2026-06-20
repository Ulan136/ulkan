// app/api/track/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cardProgress } from '@/lib/ids'

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

  const progress = cardProgress(order.positions)

  return NextResponse.json({
    id: order.id,
    from: order.from,
    to: order.to,
    status: order.status,
    screen: order.screen,
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
  })
}
