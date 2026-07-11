import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

// Границы «сегодня» по Asia/Almaty (UTC+5, без DST), как UTC-инстанты.
// todayKey = Алматы 00:00 (канонический ключ дня для черновика).
function almatyDay() {
  const OFFSET = 5 * 60 * 60 * 1000
  const shifted = new Date(Date.now() + OFFSET) // UTC-поля = локальное время Алматы
  const todayKey = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - OFFSET)
  const tomorrowKey = new Date(todayKey.getTime() + 24 * 60 * 60 * 1000)
  return { todayKey, tomorrowKey }
}

// Прошлые незакрытые черновики логиста → в бухгалтерию (status='processing').
// Вчерашнее задним числом редактировать нельзя.
async function autoCloseOldDrafts(logistId: string, todayKey: Date) {
  await prisma.dailyReport.updateMany({
    where: { logistId, status: 'draft', date: { lt: todayKey } },
    data: { status: 'processing', comment: 'Закрыт автоматически' },
  })
}

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

// GET — загрузить черновик смены логиста (только сегодняшний)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json(null, { status: 401 })

  const { todayKey, tomorrowKey } = almatyDay()
  await autoCloseOldDrafts(session.id, todayKey)

  const draft = await prisma.dailyReport.findFirst({
    where: { logistId: session.id, status: 'draft', date: { gte: todayKey, lt: tomorrowKey } },
    include: { rows: true },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(draft)
}

// POST — сохранить/обновить сегодняшний черновик
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json(null, { status: 401 })

  const { rows } = await req.json()
  const { todayKey, tomorrowKey } = almatyDay()
  await autoCloseOldDrafts(session.id, todayKey)

  const rowData = mapRows(rows)

  // Ищем сегодняшний черновик (в пределах суток Алматы)
  const existing = await prisma.dailyReport.findFirst({
    where: { logistId: session.id, status: 'draft', date: { gte: todayKey, lt: tomorrowKey } },
    orderBy: { date: 'desc' },
  })

  if (existing) {
    await prisma.dailyReportRow.deleteMany({ where: { reportId: existing.id } })
    if (rowData.length > 0) {
      await prisma.dailyReportRow.createMany({ data: rowData.map(d => ({ ...d, reportId: existing.id })) })
    }
    return NextResponse.json({ ok: true })
  } else {
    const draft = await prisma.dailyReport.create({
      data: {
        logistId: session.id,
        date: todayKey, // канонический ключ дня (Алматы 00:00)
        status: 'draft',
        comment: '',
        rows: rowData.length > 0 ? { create: rowData } : undefined,
      },
    })
    return NextResponse.json({ ok: true, id: draft.id })
  }
}

// DELETE — удалить сегодняшний черновик (после закрытия смены)
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json(null, { status: 401 })

  const { todayKey, tomorrowKey } = almatyDay()
  await prisma.dailyReport.deleteMany({
    where: { logistId: session.id, status: 'draft', date: { gte: todayKey, lt: tomorrowKey } },
  })
  return NextResponse.json({ ok: true })
}
