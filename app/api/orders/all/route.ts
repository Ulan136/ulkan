import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { orderInclude } from '@/lib/orderMetrics'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const orders = await prisma.order.findMany({
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}

// POST /api/orders/all — провести все в бухгалтерию
export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const result = await prisma.order.updateMany({
    where: { screen: 'accounting', postponed: false },
    data: { screen: 'bookkeeping', status: 'Бухгалтерия', toacc: false },
  })
  return NextResponse.json({ success: true, count: result.count })
}
