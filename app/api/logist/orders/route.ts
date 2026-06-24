import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const myName = session.name

  const orders = await prisma.order.findMany({
    where: {
      isCancelled: false,
      screen: { in: ['outgoing', 'incoming', 'reception'] },
      OR: [
        { positions: { some: { resp: myName } } },
        { from: myName },
      ]
    },
    include: { positions: { orderBy: { createdAt: 'asc' } } },
    orderBy: { updatedAt: 'desc' }
  })

  return NextResponse.json(orders)
}
