import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { orderInclude } from '@/lib/orderMetrics'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const myName = session.name
  const myId   = session.id

  // Ищем карточки где:
  // 1. Есть позиции с resp = имя логиста (КО МНЕ)
  // 2. Карточка создана логистом from = имя логиста (ОТ МЕНЯ)
  // 3. Карточка где fromId = id логиста
  const orders = await prisma.order.findMany({
    where: {
      isCancelled: false,
      screen: { in: ['outgoing', 'incoming', 'reception'] },
      OR: [
        { positions: { some: { resp: { equals: myName, mode: 'insensitive' } } } },
        { from: { equals: myName, mode: 'insensitive' } },
        { fromId: myId },
      ]
    },
    include: orderInclude,
    orderBy: { updatedAt: 'desc' }
  })

  return NextResponse.json(orders)
}
