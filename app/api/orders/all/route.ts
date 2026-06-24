<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
=======
// app/api/orders/all/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

<<<<<<< HEAD
  const orders = await prisma.order.findMany({
    include: { positions: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
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
=======
  try {
    const orders = await prisma.order.findMany({
      include: { positions: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
    })
    return NextResponse.json(orders)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
<<<<<<< HEAD

  return NextResponse.json({ success: true, count: toPost.length })
}
=======
}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
