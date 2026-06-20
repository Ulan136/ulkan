// app/api/orders/all/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const orders = await prisma.order.findMany({
    include: { positions: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(orders)
}

export async function POST() {
  // postAll — send all accounting to bookkeeping
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const toPost = await prisma.order.findMany({
    where: { screen: 'accounting', postponed: false },
  })

  await prisma.order.updateMany({
    where: { screen: 'accounting', postponed: false },
    data: { screen: 'bookkeeping', status: 'Бухгалтерия', toacc: false },
  })

  for (const o of toPost) {
    await prisma.history.create({
      data: { cardId: o.id, action: 'Проведён в Бухгалтерию', detail: 'Пакетное проведение', userName: session.name },
    })
  }

  return NextResponse.json({ success: true, count: toPost.length })
}
