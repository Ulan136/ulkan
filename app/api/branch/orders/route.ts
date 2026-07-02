import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const myName = session.name

  // Входящие (адресованные мне) + Исходящие (я отправил)
  const orders = await prisma.order.findMany({
    where: {
      isCancelled: false,
      OR: [
        { to: myName, screen: { in: ['outgoing', 'incoming'] } },
        { from: myName, screen: { in: ['outgoing', 'incoming'] } },
      ]
    },
    include: {
      positions: {
        select: { id: true, cardId: true, name1c: true, oral: true, qty: true, unit: true, status: true, resp: true, supplier: true, payment: true, deadline: true, late: true, createdAt: true, updatedAt: true }
      }
    },
    orderBy: { updatedAt: 'desc' }
  })

  return NextResponse.json(orders)
}
