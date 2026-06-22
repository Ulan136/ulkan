// app/api/stock/movements/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  try {
    const movements = await prisma.stockMovement.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json(movements)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
