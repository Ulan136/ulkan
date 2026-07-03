import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  const sp = await prisma.specProject.findUnique({
    where: { id },
    include: {
      items: true,
      orders: { include: { positions: true } },
    },
  })
  if (!sp) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const analysis = sp.items.map(item => {
    const collected = sp.orders.reduce((s, o) => {
      return s + o.positions.filter(p => p.name1c === item.name || p.oral === item.name).reduce((ps, p) => ps + p.qty, 0)
    }, 0)
    const remaining = Math.max(0, item.qty - collected)
    const pct = item.qty > 0 ? Math.round(Math.min(collected / item.qty * 100, 100)) : 0
    return { name: item.name, unit: item.unit, needed: item.qty, collected, remaining, pct }
  })

  return NextResponse.json(analysis)
}
