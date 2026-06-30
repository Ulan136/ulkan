import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const myName = session.name

  // Берём ВСЕ активные карточки из outgoing и incoming
  // где есть позиции с resp = моё имя
  const orders = await prisma.order.findMany({
    where: {
      isCancelled: false,
      screen: { in: ['outgoing', 'incoming'] },
      positions: {
        some: {
          resp: myName
        }
      }
    },
    include: {
      positions: { orderBy: { createdAt: 'asc' } }
    },
    orderBy: { updatedAt: 'desc' }
  })

  return NextResponse.json(orders)
}
