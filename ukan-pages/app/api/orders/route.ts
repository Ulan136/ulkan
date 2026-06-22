// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateCardId, generatePosId, generateTrackingLink } from '@/lib/ids'
import { notifyAdmins, notifyUser } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    const body = await req.json()
    const {
      from, to = '', comment = '', phone, deadline,
      projectId, specProjectId, contactId,
      source = 'admin_manual', isDraft = false,
      positions = [], fromId,
    } = body

    if (!from) return NextResponse.json({ error: 'Укажите отправителя' }, { status: 400 })

    const id = generateCardId()
    const trackingLink = generateTrackingLink(id)

    // Создаём позиции БЕЗ cardId (Prisma подставит сам через relation)
    const posData = positions
      .filter((p: { name1c?: string; oral?: string }) => p.name1c || p.oral)
      .map((p: { name1c?: string; oral?: string; qty?: number; unit?: string; price?: number; resp?: string; supplier?: string; supplierId?: string; payment?: string; deadline?: string }, i: number) => ({
        id: generatePosId(id, i + 1),
        name1c: p.name1c || '',
        oral: p.oral || '',
        qty: p.qty || 1,
        unit: p.unit || 'шт',
        price: p.price || 0,
        resp: p.resp || '',
        supplier: p.supplier || '',
        supplierId: p.supplierId || null,
        payment: p.payment || '',
        deadline: p.deadline ? new Date(p.deadline) : null,
        status: 'В работе',
      }))

    // Определяем screen и status
    const screen = isDraft ? 'incoming' : (posData.length > 0 ? 'outgoing' : 'incoming')
    const status = isDraft ? 'Черновик' : (posData.length > 0 ? 'В работе' : 'В ожидании')

    const order = await prisma.order.create({
      data: {
        id, from, fromId: fromId || null, to, screen, status, source,
        comment, phone: phone || null,
        deadline: deadline ? new Date(deadline) : null,
        projectId: projectId || null,
        specProjectId: specProjectId || null,
        contactId: contactId || null,
        isDraft, trackingLink,
        positions: posData.length > 0 ? { create: posData } : undefined,
      },
      include: { positions: true },
    })

    // История
    await prisma.history.create({
      data: { cardId: id, action: 'Создан заказ', detail: `${from} → ${to}`, userName: session.name }
    })

    // Уведомления
    if (!isDraft) {
      await notifyAdmins(`Новый заказ ${id} от ${from}`, id)
      if (fromId) await notifyUser(fromId, `Ваша заявка ${id} принята`, id)
    }

    return NextResponse.json(order, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
