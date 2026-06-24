<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
=======
// app/api/reports/daily/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
import { notifyBookkeepers } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
<<<<<<< HEAD
  if (!['super_admin', 'bookkeeper'].includes(session.role)) {
    return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
  }

  const reports = await prisma.dailyReport.findMany({
    include: { logist: true, rows: true },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(reports)
=======

  try {
    const reports = await prisma.dailyReport.findMany({
      include: { logist: { select: { id: true, name: true } }, rows: true },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(reports)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
<<<<<<< HEAD
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
=======
  if (!session || session.role !== 'logist') return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  try {
    const { date, comment = '', rows = [] } = await req.json()
    const report = await prisma.dailyReport.create({
      data: {
        logistId: session.id,
        date: date ? new Date(date) : new Date(),
        comment, status: 'processing',
        rows: { create: rows },
      },
      include: { rows: true, logist: { select: { id: true, name: true } } },
    })
    await notifyBookkeepers(`Новый отчёт по смене от ${session.name}`)
    return NextResponse.json(report, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
