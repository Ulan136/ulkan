// app/api/reports/daily/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyBookkeepers } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

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
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
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
