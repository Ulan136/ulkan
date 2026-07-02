import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { generateCardId, generateTrackingLink } from '@/lib/ids'
import { notifyAdmins } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  // Для филиала — показываем и свои заявки и карточки адресованные филиалу
  const isBranch = session.role === 'branch'

  const orders = await prisma.order.findMany({
    where: isBranch
      ? {
          isCancelled: false,
          OR: [
            { fromId: session.id },
            { to: session.name, screen: { in: ['outgoing', 'incoming'] } },
          ]
        }
      : { fromId: session.id },
    include: {
      positions: {
        select: { id: true, cardId: true, name1c: true, oral: true, qty: true, unit: true, status: true, late: true, createdAt: true, updatedAt: true, resp: true, supplier: true, supplierId: true, payment: true, deadline: true },
      },
      history: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { to, deadline, text, comment } = await req.json()

  const count = await prisma.order.count()
  const cardId = generateCardId(count)
  const trackingLink = generateTrackingLink(cardId)

  const order = await prisma.order.create({
    data: {
      id: cardId, from: session.name, fromId: session.id,
      to: to || '', comment: text || comment || '',
      source: 'cabinet', status: 'В ожидании', trackingLink,
      deadline: deadline ? new Date(deadline) : null,
      contactId: session.id,
      history: { create: { action: 'Заявка создана из кабинета', userName: session.name } },
    },
    include: { positions: true },
  })

  await notifyAdmins(`Новая заявка ${cardId} от ${session.name}`, cardId)
  return NextResponse.json({ order, trackingUrl: trackingLink }, { status: 201 })
}
