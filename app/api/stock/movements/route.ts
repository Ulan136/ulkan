<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
=======
// app/api/stock/movements/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
<<<<<<< HEAD
  const limit = Number(searchParams.get('limit') || 100)

  const movements = await prisma.stockMovement.findMany({
    where: type ? { type } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json(movements)
}
=======

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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
