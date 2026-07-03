// app/api/client/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateCardId, generateTrackingLink } from '@/lib/ids'
import { notifyAdmins } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    const orders = await prisma.order.findMany({
      where: { fromId: session.id },
      include: {
        positions: {
          select: { id: true, name1c: true, oral: true, qty: true, unit: true, status: true }
          // БЕЗ price — клиент не видит цены
        }
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(orders)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    const { to = '', deadline, comment = '', text = '', isDraft = false } = await req.json()

    const cardId = generateCardId()
    const trackingLink = generateTrackingLink(cardId)

    const order = await prisma.order.create({
      data: {
        id: cardId, from: session.name, fromId: session.id,
        to, screen: 'incoming', status: isDraft ? 'Черновик' : 'В ожидании',
        source: 'cabinet', comment: text || comment,
        deadline: deadline ? new Date(deadline) : null,
        isDraft, trackingLink,
      },
      include: { positions: { select: { id: true, name1c: true, oral: true, qty: true, unit: true, status: true } } },
    })

    await prisma.history.create({
      data: { cardId, action: 'Создана заявка', detail: session.name, userName: session.name }
    })

    if (!isDraft) {
      await notifyAdmins(`Новая заявка ${cardId} от ${session.name}`, cardId)
    }

    return NextResponse.json({ order, trackingUrl: trackingLink }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
