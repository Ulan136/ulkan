// app/api/reports/daily/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session || !['super_admin', 'bookkeeper'].includes(session.role)) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }

  try {
    const { status } = await req.json()
    const report = await prisma.dailyReport.update({
      where: { id: params.id },
      data: { status },
      include: { rows: true },
    })
    return NextResponse.json(report)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
