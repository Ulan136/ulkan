import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  // Только филиал — иначе не-branch (напр. админ) получил бы чужую выдачу с пустыми positions.
  const auth = await requireSession(req, ['branch'])
  if (!auth.ok) return auth.response
  const { session } = auth

  const myName = session.name

  const orders = await prisma.order.findMany({
    where: {
      isCancelled: false,
      OR: [
        // ВЫБОРКА карточки — я поставщик хотя бы одной позиции (без leg!). Отображение
        // и раскладка по вкладкам (Входящие=leg1 / Исходящие=leg2) — на фронте.
        { positions: { some: { supplier: { equals: myName, mode: 'insensitive' } } } },
        // legacy card-level (адресованные мне / мои заявки), screen НЕ ограничиваем — история до архива
        { to: { equals: myName, mode: 'insensitive' } },
        { from: { equals: myName, mode: 'insensitive' } },
      ]
    },
    include: {
      // Возвращаем ТОЛЬКО мои позиции (я — поставщик) — чужие в браузер не уходят.
      positions: {
        where: { supplier: { equals: myName, mode: 'insensitive' } },
        select: { id: true, cardId: true, name1c: true, oral: true, qty: true, unit: true, status: true, leg: true, resp: true, supplier: true, payment: true, deadline: true, late: true, createdAt: true, updatedAt: true }
      }
    },
    orderBy: { updatedAt: 'desc' }
  })

  return NextResponse.json(orders)
}
