import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession, getSessionFromRequest } from '@/lib/auth'
import { notifyBookkeepers } from '@/lib/notifications'
import { pushSignal } from '@/lib/pusherServer'
import { almatyDay } from '@/lib/reportDay'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response

  const reports = await prisma.dailyReport.findMany({
    include: { logist: true, rows: true },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'logist') return NextResponse.json({ error: 'Только логисты' }, { status: 403 })

  const { date, comment, rows } = await req.json()
  // Ключ дня — Алматы 00:00 (как в черновике reports/draft), а не UTC-полночь
  // от new Date('YYYY-MM-DD'), иначе отчёт и его черновик расходятся по дню.
  const { dayKey } = almatyDay(date)
  const rowData = (Array.isArray(rows) ? rows : []).map((r: any) => ({
    name: r.name || '', posId: r.posId || '',
    qtyIn: Number(r.qtyIn) || 0, fromWho: r.fromWho || '', commentIn: r.commentIn || '',
    toWho: r.toWho || '', qtyOut: Number(r.qtyOut) || 0, commentOut: r.commentOut || '',
    invoiceNum: r.invoiceNum || '',
  }))
  const report = await prisma.dailyReport.create({
    data: {
      logistId: session.id, date: dayKey, comment: comment || '', status: 'processing',
      rows: rowData.length > 0 ? { create: rowData } : undefined,
    },
    include: { logist: true, rows: true },
  })

  await notifyBookkeepers(`Новый отчёт от ${session.name} за ${new Date(date).toLocaleDateString('ru-RU')}`)
  await pushSignal('reports')
  return NextResponse.json(report, { status: 201 })
}
