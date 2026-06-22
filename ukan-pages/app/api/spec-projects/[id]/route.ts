// app/api/spec-projects/[id]/route.ts - анализ сметы vs собрано
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    const sp = await prisma.specProject.findUnique({
      where: { id: params.id },
      include: {
        items: true,
        orders: { include: { positions: true } },
      },
    })
    if (!sp) return NextResponse.json({ error: 'Не найден' }, { status: 404 })

    // Агрегация: смета vs собрано
    const allPositions = sp.orders.flatMap((o: { positions: { name1c: string; status: string; qty: number; unit: string }[] }) => o.positions)

    const analysis = sp.items.map((item: { name: string; qty: number; unit: string }) => {
      const collected = allPositions
        .filter((p: { name1c: string; status: string }) => p.name1c === item.name && p.status === 'Доставлено')
        .reduce((s: number, p: { qty: number }) => s + p.qty, 0)
      return {
        name: item.name,
        unit: item.unit,
        needed: item.qty,
        collected,
        remaining: Math.max(0, item.qty - collected),
        pct: item.qty === 0 ? 100 : Math.round((collected / item.qty) * 100),
      }
    })

    const totalPct = analysis.length === 0 ? 0 : Math.round(analysis.reduce((s: number, a: { pct: number }) => s + a.pct, 0) / analysis.length)

    return NextResponse.json({ specProject: sp, analysis, totalPct })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    const { status } = await req.json()
    const sp = await prisma.specProject.update({ where: { id: params.id }, data: { status } })
    return NextResponse.json(sp)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
