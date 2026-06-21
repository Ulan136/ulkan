import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (session.role !== 'logist') {
    return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
  }

  const orders = await prisma.order.findMany({
    include: { positions: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}