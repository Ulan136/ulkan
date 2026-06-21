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