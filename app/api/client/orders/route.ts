import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { generateCardId, generateTrackingLink, generatePosId } from '@/lib/ids'
import { notifyAdmins } from '@/lib/notifications'
import { pushSignal } from '@/lib/pusherServer'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { session } = auth

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
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { session } = auth

  const { to, deadline, text, comment, positions } = await req.json()

  const count = await prisma.order.count()
  const cardId = generateCardId(count)
  const trackingLink = generateTrackingLink(cardId)

  // Позиции из каталога (NomPicker): готовые Наименование+Кол-во. Текстовое
  // поле заявки остаётся запасным путём (comment). На приёмку заявка приходит
  // уже с позициями — стол показывает их как обычно.
  let posData: any[] = []
  if (Array.isArray(positions) && positions.length > 0) {
    posData = positions.map((p: any, i: number) => ({
      id: generatePosId(cardId, i + 1),
      name1c: p.name1c || '',
      oral: p.oral || p.name1c || '',
      qty: Number(p.qty) || 0,
      unit: p.unit || 'шт',
      status: 'В работе',
    }))
  }

  const order = await prisma.order.create({
    data: {
      id: cardId, from: session.name, fromId: session.id,
      to: to || '', comment: text || comment || '',
      source: 'cabinet', status: 'В ожидании', trackingLink,
      deadline: deadline ? new Date(deadline) : null,
      contactId: session.id,
      history: { create: { action: 'Заявка создана из кабинета', userName: session.name } },
      positions: posData.length > 0 ? { create: posData } : undefined,
    },
    include: { positions: true },
  })

  await notifyAdmins(`Новая заявка ${cardId} от ${session.name}`, cardId)
  await pushSignal('orders')
  return NextResponse.json({ order, trackingUrl: trackingLink }, { status: 201 })
}
