import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession, getSessionFromRequest } from '@/lib/auth'
import { notifyBookkeepers } from '@/lib/notifications'
import { pushSignal } from '@/lib/pusherServer'
import { almatyDay } from '@/lib/reportDay'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response

  // Явный select: переживает старые строки с posId=NULL/без колонки (не читаем
  // posId — фронту он не нужен) и не отдаёт password-хэш логиста (как в коммите A).
  const reports = await prisma.dailyReport.findMany({
    orderBy: { date: 'desc' },
    select: {
      id: true, logistId: true, date: true, comment: true, status: true, createdAt: true,
      logist: { select: { id: true, name: true } },
      rows: {
        select: {
          id: true, reportId: true, name: true, fromWho: true, qtyIn: true, commentIn: true,
          toWho: true, qtyOut: true, commentOut: true, invoiceNum: true,
        },
      },
    },
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
