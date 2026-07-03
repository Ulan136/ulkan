// app/api/orders/postAll/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    const result = await prisma.order.updateMany({
      where: { screen: 'accounting', postponed: false },
      data: { screen: 'bookkeeping', status: 'Бухгалтерия' },
    })
    return NextResponse.json({ success: true, count: result.count })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
