import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { notifyBookkeepers } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!['super_admin', 'bookkeeper'].includes(session.role)) {
    return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
  }

  const reports = await prisma.dailyReport.findMany({
    include: { logist: true, rows: true },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'logist') {
    return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
  }

  const { date, comment, rows } = await req.json()
  const report = await prisma.dailyReport.create({
    data: {
      logistId: session.id,
      date: new Date(date),
      comment: comment || '',
      status: 'processing',
      rows: rows?.length ? {
        create: rows.map((r: Record<string, unknown>) => ({
          fromWho: r.fromWho || '',
          name: r.name || '',
          qtyIn: Number(r.qtyIn) || 0,
          commentIn: r.commentIn || '',
          toWho: r.toWho || '',
          qtyOut: Number(r.qtyOut) || 0,
          commentOut: r.commentOut || '',
          invoiceNum: r.invoiceNum || '',
        })),
      } : undefined,
    },
    include: { rows: true, logist: true },
  })

  await notifyBookkeepers(`Новый отчёт от ${session.name}`)
  return NextResponse.json(report, { status: 201 })
}