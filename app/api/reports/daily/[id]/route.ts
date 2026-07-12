import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { pushSignal } from '@/lib/pusherServer'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session || !['super_admin', 'bookkeeper'].includes(session.role)) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  const { id } = await params
  const { status } = await req.json()
  const report = await prisma.dailyReport.update({ where: { id }, data: { status }, include: { logist: true, rows: true } })
  await pushSignal('reports')
  return NextResponse.json(report)
}
