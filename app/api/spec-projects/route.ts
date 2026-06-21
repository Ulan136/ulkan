import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { generateSpecProjectId } from '@/lib/ids'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const specProjects = await prisma.specProject.findMany({
    include: { items: true, _count: { select: { orders: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(specProjects)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { name, clientId, description, items } = await req.json()
  if (!name) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })

  const specProject = await prisma.specProject.create({
    data: {
      id: generateSpecProjectId(),
      name,
      clientId: clientId || null,
      description: description || '',
      items: items?.length ? {
        create: items.map((item: { name: string; qty: number; unit?: string; nomenclatureId?: string }) => ({
          name: item.name,
          qty: item.qty,
          unit: item.unit || 'шт',
          nomenclatureId: item.nomenclatureId || null,
        })),
      } : undefined,
    },
    include: { items: true },
  })
  return NextResponse.json(specProject, { status: 201 })
}