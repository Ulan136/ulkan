import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
<<<<<<< HEAD
import { getSessionFromRequest } from '@/lib/auth'
import { generateCardId, generatePosId, generateTrackingLink } from '@/lib/ids'
import { notifyAdmins } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const body = await req.json()
    const {
      from, fromId, to, comment, phone, deadline, projectId, specProjectId, contactId,
      source = 'admin_manual', isDraft = false, positions, directOutgoing = false,
    } = body

    if (!from) return NextResponse.json({ error: 'Поле from обязательно' }, { status: 400 })

    const cardId = generateCardId()
    const trackingLink = generateTrackingLink(cardId)

    const posCreate = positions?.length
      ? positions.map((p: Record<string, unknown>, i: number) => ({
          id: generatePosId(cardId, i + 1),
          name1c: String(p.name1c || ''),
          oral: String(p.oral || ''),
          qty: Number(p.qty) || 0,
          unit: String(p.unit || 'шт'),
          price: Number(p.price) || 0,
          resp: String(p.resp || ''),
          supplier: String(p.supplier || ''),
          payment: String(p.payment || ''),
          status: String(p.status || 'В работе'),
          deadline: p.deadline ? new Date(p.deadline as string) : undefined,
        }))
      : []

    const order = await prisma.order.create({
      data: {
        id: cardId,
        from,
        fromId: fromId || null,
        to: to || '',
        screen: isDraft ? 'incoming' : directOutgoing ? 'outgoing' : 'incoming',
        status: isDraft ? 'Черновик' : directOutgoing ? 'В работе' : 'В ожидании',
        block: directOutgoing ? '' : '',
        source,
        isDraft,
        comment: comment || '',
        phone: phone || null,
=======
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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
        deadline: deadline ? new Date(deadline) : null,
        projectId: projectId || null,
        specProjectId: specProjectId || null,
        contactId: contactId || null,
<<<<<<< HEAD
        trackingLink,
        positions: posCreate.length ? { create: posCreate } : undefined,
=======
        isDraft, trackingLink,
        positions: posData.length > 0 ? { create: posData } : undefined,
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
      },
      include: { positions: true },
    })

<<<<<<< HEAD
    await prisma.history.create({
      data: {
        cardId,
        action: isDraft ? 'Создан черновик' : 'Создан заказ',
        detail: `Источник: ${source}`,
        userName: session.name,
      },
    })

    if (source === 'cabinet' || source === 'external') {
      await notifyAdmins(`Новая заявка ${cardId} от ${from}`, cardId)
=======
    // История
    await prisma.history.create({
      data: { cardId: id, action: 'Создан заказ', detail: `${from} → ${to}`, userName: session.name }
    })

    // Уведомления
    if (!isDraft) {
      await notifyAdmins(`Новый заказ ${id} от ${from}`, id)
      if (fromId) await notifyUser(fromId, `Ваша заявка ${id} принята`, id)
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
    }

    return NextResponse.json(order, { status: 201 })
  } catch (e) {
<<<<<<< HEAD
    console.error('Create order error:', e)
    return NextResponse.json({ error: 'Ошибка создания' }, { status: 500 })
  }
}
=======
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
