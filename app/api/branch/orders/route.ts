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
        // Адресованные мне (legacy branch-as-recipient), кроме архива
        { to: { equals: myName, mode: 'insensitive' }, screen: { notIn: ['archive'] } },
        // Мои заявки / переданное дальше (legacy card-level), на всех стадиях
        { from: { equals: myName, mode: 'insensitive' } },
        // Per-position: я поставщик хотя бы одной позиции (leg=1 изготовление / leg=2 передано)
        { positions: { some: { supplier: { equals: myName, mode: 'insensitive' } } } },
      ]
    },
    include: {
      positions: {
        select: { id: true, cardId: true, name1c: true, oral: true, qty: true, unit: true, status: true, leg: true, resp: true, supplier: true, payment: true, deadline: true, late: true, createdAt: true, updatedAt: true }
      }
    },
    orderBy: { updatedAt: 'desc' }
  })

  return NextResponse.json(orders)
}
