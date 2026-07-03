// app/api/track/route.ts - публичный трекинг
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fmtDateTime } from '@/lib/display'

const PCT: Record<string, number> = { 'В ожидании': 1, 'Принят': 2, 'В обработке': 2, 'В работе': 3, 'Готово к отгрузке': 4, 'В пути': 4, 'Доставлено': 5 }
const POS_PCT: Record<string, number> = { 'В работе': 10, 'Готово к отгрузке': 60, 'В пути': 80, 'Доставлено': 100 }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Укажите ID заказа' }, { status: 400 })

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        positions: { orderBy: { createdAt: 'asc' } },
        history: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })

    const stage = PCT[order.status] || 3
    const progress = order.positions.length === 0 ? (stage === 5 ? 100 : stage * 20) :
      Math.round(order.positions.reduce((s: number, p: { status: string }) => s + (POS_PCT[p.status] || 0), 0) / order.positions.length)

    const icons: Record<string, string> = { 'В ожидании': '📋', 'Принят': '📦', 'В обработке': '🔧', 'В работе': '🚚', 'В пути': '🚛', 'Доставлено': '✅' }

    return NextResponse.json({
      id: order.id,
      from: order.from,
      to: order.to,
      status: order.status,
      stage,
      progress,
      heroIcon: icons[order.status] || '📦',
      createdAt: order.createdAt,
      delivered: order.delivered,
      // БЕЗ ЦЕН!
      positions: order.positions.map((p: { id: string; name1c: string; oral: string; qty: number; unit: string; status: string }) => ({
        id: p.id, name: p.name1c || p.oral || '—',
        qty: p.qty, unit: p.unit, status: p.status,
      })),
      history: order.history.map((h: { action: string; detail: string; createdAt: Date }) => ({
        text: h.action + (h.detail ? ': ' + h.detail : ''),
        time: fmtDateTime(h.createdAt.toISOString()),
      })),
      details: [
        { k: 'Номер', v: order.id },
        { k: 'Заказчик', v: order.from },
        { k: 'Получатель', v: order.to || '—' },
        { k: 'Позиций', v: String(order.positions.length) },
      ],
      showChange: order.status !== 'Доставлено' && order.status !== 'Отменён' && !order.isCancelled,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
