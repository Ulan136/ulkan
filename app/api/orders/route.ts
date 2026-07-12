import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { generateCardId, generateTrackingLink, generatePosId } from '@/lib/ids'
import { notifyAdmins } from '@/lib/notifications'
import { reserveStock } from '@/lib/stock'
import { orderInclude } from '@/lib/orderMetrics'
import { branchNameSet } from '@/services/legDetection'
import { pushSignal } from '@/lib/pusherServer'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const orders = await prisma.order.findMany({ include: orderInclude, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { session } = auth

  try {
    const body = await req.json()
    const {
      from, to, comment, phone, deadline,
      projectId, specProjectId, contactId,
      source, isDraft, positions,
      screen: bodyScreen,  // ← принимаем screen из body!
      fromId,
    } = body

    // Определяем screen:
    // - если isDraft → incoming
    // - если передан screen явно → используем
    // - иначе incoming (для карточек из кабинета/трекинга)
    const screen = isDraft ? 'incoming' : (bodyScreen || 'incoming')

    const count = await prisma.order.count()
    const id = generateCardId(count)
    const trackingLink = generateTrackingLink(id)

    let posData: any[] = []
    if (positions && positions.length > 0) {
      const branches = await branchNameSet()  // leg per-position: поставщик-филиал → 1
      posData = positions.map((p: any, i: number) => ({
        id: generatePosId(id, i + 1),
        name1c: p.name1c || '',
        oral: p.oral || '',
        qty: p.qty || 0,
        unit: p.unit || 'шт',
        price: p.price || 0,
        resp: p.resp || '',
        supplier: p.supplier || '',
        supplierId: p.supplierId || null,
        status: p.status || 'В работе',
        leg: branches.has((p.supplier || '').trim().toLowerCase()) ? 1 : 2,
        deadline: p.deadline ? new Date(p.deadline) : null,
        payment: p.payment || '',
      }))
    }

    const order = await prisma.order.create({
      data: {
        id, from,
        fromId: fromId || null,
        to: to || '',
        screen,              // ← теперь правильный screen!
        comment: comment || '',
        phone: phone || null,
        deadline: deadline ? new Date(deadline) : null,
        projectId: projectId || null,
        specProjectId: specProjectId || null,
        contactId: contactId || null,
        source: source || 'admin_manual',
        isDraft: isDraft || false,
        trackingLink,
        history: { create: { action: 'Карточка создана', userName: session.name } },
        positions: posData.length > 0 ? { create: posData } : undefined,
      },
      include: orderInclude,
    })

    // Резервируем склад для позиций с Центр Склад
    for (const pos of order.positions) {
      if (pos.supplier === 'Центр Склад' && pos.qty > 0) {
        await reserveStock(pos.id, pos.name1c || pos.oral, pos.qty)
      }
    }

    await notifyAdmins(`Новая карточка ${id} от ${from}`, id)
    await pushSignal('orders')
    return NextResponse.json(order, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка создания карточки' }, { status: 500 })
  }
}
