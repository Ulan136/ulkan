import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
        deadline: deadline ? new Date(deadline) : null,
        projectId: projectId || null,
        specProjectId: specProjectId || null,
        contactId: contactId || null,
        trackingLink,
        positions: posCreate.length ? { create: posCreate } : undefined,
      },
      include: { positions: true },
    })

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
    }

    return NextResponse.json(order, { status: 201 })
  } catch (e) {
    console.error('Create order error:', e)
    return NextResponse.json({ error: 'Ошибка создания' }, { status: 500 })
  }
}