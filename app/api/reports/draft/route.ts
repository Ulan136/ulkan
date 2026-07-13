import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { pushSignal } from '@/lib/pusherServer'
import { almatyDay } from '@/lib/reportDay'

// Поля ручной строки (без posId — posId только у авто-строк доставки).
function rowFields(r: any) {
  return {
    name: r?.name || '',
    fromWho: r?.fromWho || '',
    qtyIn: Number(r?.qtyIn) || 0,
    commentIn: r?.commentIn || '',
    toWho: r?.toWho || '',
    qtyOut: Number(r?.qtyOut) || 0,
    commentOut: r?.commentOut || '',
    invoiceNum: r?.invoiceNum || '',
  }
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

// POST — СОБЫТИЙНЫЕ операции над строками черновика (никакой автосборки/bulk-replace):
//   { op:'add', row, date? } → добавить РУЧНУЮ строку (posId='') в черновик дня (создать блок, если нет)
//   { op:'update', id, row }  → изменить строку по id
//   { op:'delete', id }       → удалить строку по id
// Авто-строки доставки создаются НЕ здесь, а в updatePos-эффекте (событие доставки).
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json(null, { status: 401 })

  const body = await req.json()
  const op = body?.op

  if (op === 'update') {
    await prisma.dailyReportRow.updateMany({
      where: { id: body.id, report: { logistId: session.id, status: 'draft' } },
      data: rowFields(body.row),
    })
    await pushSignal('reports')
    return NextResponse.json({ ok: true })
  }

  if (op === 'delete') {
    await prisma.dailyReportRow.deleteMany({
      where: { id: body.id, report: { logistId: session.id, status: 'draft' } },
    })
    await pushSignal('reports')
    return NextResponse.json({ ok: true })
  }

  if (op === 'add') {
    const { dayKey, nextKey } = almatyDay(body.date)
    let draft = await prisma.dailyReport.findFirst({
      where: { logistId: session.id, status: 'draft', date: { gte: dayKey, lt: nextKey } },
      orderBy: { date: 'desc' },
    })
    if (!draft) {
      draft = await prisma.dailyReport.create({ data: { logistId: session.id, date: dayKey, status: 'draft', comment: '' } })
    }
    await prisma.dailyReportRow.create({ data: { ...rowFields(body.row), posId: '', reportId: draft.id } })
    await pushSignal('reports')
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Неизвестная операция' }, { status: 400 })
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
