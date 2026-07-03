import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

// GET — загрузить черновик смены логиста
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json(null, { status: 401 })

  // Ищем незакрытый черновик (status = 'draft')
  const draft = await prisma.dailyReport.findFirst({
    where: { logistId: session.id, status: 'draft' },
    include: { rows: true },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(draft)
}

// POST — сохранить/обновить черновик смены
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json(null, { status: 401 })

  const { rows } = await req.json()

  // Находим или создаём черновик
  const existing = await prisma.dailyReport.findFirst({
    where: { logistId: session.id, status: 'draft' },
    orderBy: { date: 'desc' },
  })

  if (existing) {
    // Удаляем старые строки и создаём новые
    await prisma.dailyReportRow.deleteMany({ where: { reportId: existing.id } })
    if (rows?.length > 0) {
      await prisma.dailyReportRow.createMany({
        data: rows.map((r: any) => ({
          reportId: existing.id,
          name: r.name || '',
          qtyIn: Number(r.qtyIn) || 0,
          fromWho: r.fromWho || '',
          commentIn: r.commentIn || '',
          toWho: r.toWho || '',
          qtyOut: Number(r.qtyOut) || 0,
          commentOut: r.commentOut || '',
          invoiceNum: r.invoiceNum || '',
        }))
      })
    }
    return NextResponse.json({ ok: true })
  } else {
    // Создаём новый черновик
    const draft = await prisma.dailyReport.create({
      data: {
        logistId: session.id,
        date: new Date(),
        status: 'draft',
        comment: '',
        rows: rows?.length > 0 ? {
          create: rows.map((r: any) => ({
            name: r.name || '',
            qtyIn: Number(r.qtyIn) || 0,
            fromWho: r.fromWho || '',
            commentIn: r.commentIn || '',
            toWho: r.toWho || '',
            qtyOut: Number(r.qtyOut) || 0,
            commentOut: r.commentOut || '',
            invoiceNum: r.invoiceNum || '',
          }))
        } : undefined,
      }
    })
    return NextResponse.json({ ok: true, id: draft.id })
  }
}

// DELETE — удалить черновик (после закрытия смены)
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json(null, { status: 401 })

  await prisma.dailyReport.deleteMany({
    where: { logistId: session.id, status: 'draft' }
  })

  return NextResponse.json({ ok: true })
}
