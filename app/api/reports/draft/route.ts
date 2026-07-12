import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { pushSignal } from '@/lib/pusherServer'
import { almatyDay } from '@/lib/reportDay'

function mapRows(rows: any): any[] {
  return (rows || []).map((r: any) => ({
    name: r.name || '',
    qtyIn: Number(r.qtyIn) || 0,
    fromWho: r.fromWho || '',
    commentIn: r.commentIn || '',
    toWho: r.toWho || '',
    qtyOut: Number(r.qtyOut) || 0,
    commentOut: r.commentOut || '',
    invoiceNum: r.invoiceNum || '',
  }))
}

// GET — черновик смены логиста.
//   без параметров        → сегодняшний черновик (с rows)
//   ?date=YYYY-MM-DD       → черновик конкретного дня (с rows)
//   ?scope=past            → список НЕЗАКРЫТЫХ черновиков за прошлые дни [{id,date,rowCount}]
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json(null, { status: 401 })

  const { searchParams } = new URL(req.url)

  if (searchParams.get('scope') === 'past') {
    const { dayKey: todayKey } = almatyDay()
    const past = await prisma.dailyReport.findMany({
      where: { logistId: session.id, status: 'draft', date: { lt: todayKey } },
      include: { _count: { select: { rows: true } } },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(past.map(p => ({ id: p.id, date: p.date, rowCount: p._count.rows })))
  }

  const { dayKey, nextKey } = almatyDay(searchParams.get('date'))
  const draft = await prisma.dailyReport.findFirst({
    where: { logistId: session.id, status: 'draft', date: { gte: dayKey, lt: nextKey } },
    include: { rows: true },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(draft)
}

// POST — сохранить/обновить черновик. body: { rows, date? }
//   date отсутствует → сегодняшний; date=YYYY-MM-DD → черновик того дня.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json(null, { status: 401 })

  const { rows, date } = await req.json()
  const { dayKey, nextKey } = almatyDay(date)
  const rowData = mapRows(rows)

  const existing = await prisma.dailyReport.findFirst({
    where: { logistId: session.id, status: 'draft', date: { gte: dayKey, lt: nextKey } },
    orderBy: { date: 'desc' },
  })

  if (existing) {
    await prisma.dailyReportRow.deleteMany({ where: { reportId: existing.id } })
    if (rowData.length > 0) {
      await prisma.dailyReportRow.createMany({ data: rowData.map(d => ({ ...d, reportId: existing.id })) })
    }
    await pushSignal('reports')
    return NextResponse.json({ ok: true })
  } else {
    const draft = await prisma.dailyReport.create({
      data: {
        logistId: session.id,
        date: dayKey, // канонический ключ дня (Алматы 00:00)
        status: 'draft',
        comment: '',
        rows: rowData.length > 0 ? { create: rowData } : undefined,
      },
    })
    await pushSignal('reports')
    return NextResponse.json({ ok: true, id: draft.id })
  }
}

// DELETE — удалить черновик дня. ?date=YYYY-MM-DD (по умолчанию сегодняшний).
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json(null, { status: 401 })

  const { searchParams } = new URL(req.url)
  const { dayKey, nextKey } = almatyDay(searchParams.get('date'))
  await prisma.dailyReport.deleteMany({
    where: { logistId: session.id, status: 'draft', date: { gte: dayKey, lt: nextKey } },
  })
  await pushSignal('reports')
  return NextResponse.json({ ok: true })
}
