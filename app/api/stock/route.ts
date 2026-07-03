// app/api/stock/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    const stock = await prisma.stock.findMany({
      include: { supplier: true, nomenclature: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(stock.map((s: {
      id: string; name: string; unit: string; qty: number; reserved: number;
      supplier: { name: string }; nomenclature: { name: string; unit: string }
    }) => ({ ...s, available: Math.max(0, s.qty - s.reserved) })))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
