// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { generateCardId, generatePosId, generateTrackingLink } from '@/lib/ids'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const screen = searchParams.get('screen')
  const block = searchParams.get('block')

  const where: Record<string, unknown> = {}
  if (screen) where.screen = screen
  if (block) where.block = block

  const orders = await prisma.order.findMany({
    where,
    include: { positions: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await req.json()
  const { from, to, comment, projectId, positions, source = 'admin_manual', isDraft = false } = body

  if (!from) return NextResponse.json({ error: 'Поле from обязательно' }, { status: 400 })

  const cardId = generateCardId()
  const trackingLink = generateTrackingLink(cardId)

  // Parse positions from comment if not provided
  let posData: Array<{ id: string; cardId: string; oral: string; status: string }> = []

  if (positions && positions.length > 0) {
    posData = positions.map((p: Record<string, unknown>, i: number) => ({
      id: generatePosId(cardId, i + 1),
      cardId,
      name1c: p.name1c || '',
      oral: p.oral || '',
      qty: p.qty || 0,
      unit: p.unit || 'шт',
      price: p.price || 0,
      resp: p.resp || '',
      supplier: p.supplier || '',
      status: p.status || 'В работе',
    }))
  } else if (comment) {
    posData = comment
      .split('\n')
      .map((line: string) => line.trim())
      .filter(Boolean)
      .map((line: string, i: number) => ({
        id: generatePosId(cardId, i + 1),
        cardId,
        oral: line,
        status: 'В работе',
      }))
  }

  const order = await prisma.order.create({
    data: {
      id: cardId,
      from,
      to: to || '',
      screen: isDraft ? 'incoming' : 'incoming',
      status: isDraft ? 'Черновик' : 'В ожидании',
      source,
      isDraft,
      comment: comment || '',
      projectId: projectId || null,
      trackingLink,
      positions: posData.length > 0 ? { create: posData } : undefined,
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

  return NextResponse.json(order, { status: 201 })
}
