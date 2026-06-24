import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const orders = await prisma.order.findMany({
    include: { positions: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}

// POST /api/orders/all — провести все в бухгалтерию
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const result = await prisma.order.updateMany({
    where: { screen: 'accounting', postponed: false },
    data: { screen: 'bookkeeping', status: 'Бухгалтерия', toacc: false },
  })
  return NextResponse.json({ success: true, count: result.count })
}
