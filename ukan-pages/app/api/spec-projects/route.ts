// app/api/spec-projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateSpecProjectId } from '@/lib/ids'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    const specProjects = await prisma.specProject.findMany({
      include: { items: true, _count: { select: { orders: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(specProjects)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    const { name, clientId, description = '', items = [] } = await req.json()
    if (!name) return NextResponse.json({ error: 'Укажите название' }, { status: 400 })

    const sp = await prisma.specProject.create({
      data: {
        id: generateSpecProjectId(),
        name, clientId: clientId || null, description,
        items: { create: items.map((item: { name: string; qty: number; unit?: string; nomenclatureId?: string }) => ({
          name: item.name, qty: item.qty, unit: item.unit || 'шт',
          nomenclatureId: item.nomenclatureId || null,
        })) },
      },
      include: { items: true },
    })
    return NextResponse.json(sp, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
