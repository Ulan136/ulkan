import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { session } = auth

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
        // ВЫБОРКА карточки — по resp (без leg!). leg решает только ОТОБРАЖЕНИЕ (фронт).
        { positions: { some: { resp: { equals: myName, mode: 'insensitive' } } } },
        { from: { equals: myName, mode: 'insensitive' } },
        { fromId: myId },
      ]
    },
    // Возвращаем ТОЛЬКО мои позиции (любого плеча) — чужие в браузер не уходят.
    // Фронт: активная работа = leg=2, история = Доставлено, leg=1 не показывает.
    include: {
      positions: {
        where: { resp: { equals: myName, mode: 'insensitive' } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' }
  })

  return NextResponse.json(orders)
}
