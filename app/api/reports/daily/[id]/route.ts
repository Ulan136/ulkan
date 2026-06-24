<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req)
  if (!session || !['super_admin', 'bookkeeper'].includes(session.role)) {
    return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
  }

  const { id } = await params
  const { status } = await req.json()

  const report = await prisma.dailyReport.update({
    where: { id },
    data: { status },
    include: { rows: true, logist: true },
  })
  return NextResponse.json(report)
}
=======
// app/api/reports/daily/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session || !['super_admin', 'bookkeeper'].includes(session.role)) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }

  try {
    const { id } = await params
    const { status } = await req.json()
    const report = await prisma.dailyReport.update({
      where: { id },
      data: { status },
      include: { rows: true },
    })
    return NextResponse.json(report)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
