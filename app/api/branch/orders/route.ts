import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { session } = auth

  const myName = session.name

  const orders = await prisma.order.findMany({
    where: {
      isCancelled: false,
      OR: [
        // Входящие — карточки адресованные мне (в любом статусе кроме архива)
        { to: { equals: myName, mode: 'insensitive' }, screen: { notIn: ['archive'] } },
        // Исходящие — карточки которые я передал дальше
        { from: { equals: myName, mode: 'insensitive' }, screen: { in: ['outgoing', 'incoming'] } },
        // Первое плечо — я филиал-изготовитель: поставщик позиции = моё имя
        { leg: 1, positions: { some: { supplier: { equals: myName, mode: 'insensitive' } } } },
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
