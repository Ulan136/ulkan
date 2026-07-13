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

  const { date, comment } = await req.json()
  const { dayKey, nextKey } = almatyDay(date)

  // ОДИН блок движется по статусам: черновик этого дня → processing, БЕЗ смены
  // date (закреплена при создании) и БЕЗ пересоздания строк (они уже в блоке —
  // наполнялись событиями доставки/вручную). Если черновика нет (доставок не
  // было) — создаём пустой блок с dayKey.
  const draft = await prisma.dailyReport.findFirst({
    where: { logistId: session.id, status: 'draft', date: { gte: dayKey, lt: nextKey } },
  })
  let report
  if (draft) {
    report = await prisma.dailyReport.update({
      where: { id: draft.id }, // date и rows НЕ трогаем
      data: { status: 'processing', comment: comment || '' },
      include: { logist: true, rows: true },
    })
  } else {
    report = await prisma.dailyReport.create({
      data: { logistId: session.id, date: dayKey, comment: comment || '', status: 'processing' },
      include: { logist: true, rows: true },
    })
  }

  await notifyBookkeepers(`Новый отчёт от ${session.name} за ${new Date(date).toLocaleDateString('ru-RU')}`)
  await pushSignal('reports')
  return NextResponse.json(report, { status: 201 })
}
