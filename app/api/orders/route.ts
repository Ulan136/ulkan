import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { generateCardId, generateTrackingLink, generatePosId } from '@/lib/ids'
import { notifyAdmins } from '@/lib/notifications'

const WITH_POSITIONS = { positions: { orderBy: { createdAt: 'asc' as const } } }

// GET /api/orders/all — все карточки для админки
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const orders = await prisma.order.findMany({
    include: WITH_POSITIONS,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}

// POST /api/orders — создать карточку
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    const body = await req.json()
    const { from, to, comment, phone, deadline, projectId, specProjectId, contactId, source, isDraft, positions } = body

    const id = generateCardId()
    const trackingLink = generateTrackingLink(id)

    let posData: any[] = []
    if (positions && positions.length > 0) {
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
      }))
    }

    const order = await prisma.order.create({
      data: {
        id, from, to: to || '', comment: comment || '', phone: phone || null,
        deadline: deadline ? new Date(deadline) : null,
        projectId: projectId || null, specProjectId: specProjectId || null,
        contactId: contactId || null, source: source || 'admin_manual',
        isDraft: isDraft || false, trackingLink,
        history: { create: { action: 'Карточка создана', userName: session.name } },
        positions: posData.length > 0 ? { create: posData } : undefined,
      },
      include: WITH_POSITIONS,
    })

    await notifyAdmins(`Новая карточка ${id} от ${from}`, id)
    return NextResponse.json(order, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка создания карточки' }, { status: 500 })
  }
}
