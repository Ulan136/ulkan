import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { orderInclude } from '@/lib/orderMetrics'
import { isParticipant } from '@/services/cardParticipants'

// GET /api/chat/threads — карточки с сообщениями, где я участник.
// Возвращает по каждой: cardId, from/to, счётчик, последнее сообщение (текст/автор/роль/время).
// Сортировка — по свежести последнего сообщения. Гард по ролям как в messages.
export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { session } = auth

  // Карточки, у которых вообще есть сообщения.
  const withMsgs = await prisma.cardMessage.findMany({ distinct: ['cardId'], select: { cardId: true } })
  const cardIds = withMsgs.map(m => m.cardId)
  if (cardIds.length === 0) return NextResponse.json([])

  // Загружаем эти заказы и оставляем только те, где я участник.
  const orders = await prisma.order.findMany({ where: { id: { in: cardIds } }, include: orderInclude })
  const allowed = orders.filter(o => isParticipant(o, o.positions, session!))
  if (allowed.length === 0) return NextResponse.json([])
  const allowedIds = allowed.map(o => o.id)

  // Все сообщения доступных карточек (desc) — из них последнее + счётчик на карту.
  const msgs = await prisma.cardMessage.findMany({ where: { cardId: { in: allowedIds } }, orderBy: { createdAt: 'desc' } })
  const byCard = new Map<string, { last: typeof msgs[number]; count: number }>()
  for (const m of msgs) {
    const e = byCard.get(m.cardId)
    if (e) e.count++
    else byCard.set(m.cardId, { last: m, count: 1 })
  }

  const threads = allowed.map(o => {
    const e = byCard.get(o.id)
    return {
      cardId: o.id,
      from: o.from,
      to: o.to || '',
      count: e?.count || 0,
      lastText: e?.last.text || '',
      lastAuthor: e?.last.userName || '',
      lastRole: e?.last.role || '',
      lastAt: e?.last.createdAt || null,
    }
  })
    .filter(t => t.count > 0)
    .sort((a, b) => new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime())

  return NextResponse.json(threads)
}
