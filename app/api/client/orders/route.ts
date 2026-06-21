import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { generateCardId, generateTrackingLink } from '@/lib/ids'
import { notifyAdmins } from '@/lib/notifications'

function stripPrices<T extends { positions: Array<{ price?: number }> }>(orders: T[]) {
  return orders.map(o => ({
    ...o,
    positions: o.positions.map(({ price, ...rest }) => rest),
  }))
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!['client', 'supplier_client'].includes(session.role)) {
    return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
  }

  const orders = await prisma.order.findMany({
    where: { fromId: session.id },
    include: { positions: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(stripPrices(orders))
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { to, deadline, text, comment, isDraft } = await req.json()
  const cardId = generateCardId()
  const trackingLink = generateTrackingLink(cardId)
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  const order = await prisma.order.create({
    data: {
      id: cardId,
      from: session.name,
      fromId: session.id,
      to: to || '',
      comment: text || comment || '',
      source: 'cabinet',
      status: isDraft ? 'Черновик' : 'В ожидании',
      isDraft: !!isDraft,
      deadline: deadline ? new Date(deadline) : null,
      trackingLink,
    },
    include: { positions: true },
  })

  await prisma.history.create({
    data: { cardId, action: isDraft ? 'Черновик' : 'Заявка из кабинета', detail: '', userName: session.name },
  })

  if (!isDraft) await notifyAdmins(`Новая заявка ${cardId} от ${session.name}`, cardId)

  return NextResponse.json({
    order: stripPrices([order])[0],
    trackingUrl: `${base}/track?id=${cardId}`,
  }, { status: 201 })
}