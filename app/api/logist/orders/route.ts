import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  // Только логист — иначе не-logist получил бы чужую выдачу с пустыми positions.
  const auth = await requireSession(req, ['logist'])
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
    include: { positions: { orderBy: { createdAt: 'asc' } } },
    orderBy: { updatedAt: 'desc' }
  })

  // Состав позиций:
  //  • МОИ карточки (from/fromId = я) → ВСЕ позиции — иначе «Исходящие» теряют
  //    состав карточки, если resp позиции не я (переназначение/многопозиционные).
  //  • Карточки, где я лишь resp-участник → только мои позиции (чужие не отдаём).
  const eq = (a?: string) => (a || '').trim().toLowerCase() === (myName || '').trim().toLowerCase()
  const result = orders.map(o => {
    const owns = eq(o.from) || o.fromId === myId
    return { ...o, positions: owns ? o.positions : o.positions.filter(p => eq(p.resp)) }
  })

  return NextResponse.json(result)
}
