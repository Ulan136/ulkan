import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { generateSpecProjectId } from '@/lib/ids'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const specProjects = await prisma.specProject.findMany({
    include: { items: true, _count: { select: { orders: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(specProjects)
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { name, clientId, description, items } = await req.json()
  const sp = await prisma.specProject.create({
    data: {
      id: generateSpecProjectId(await prisma.specProject.count()), name,
      clientId: clientId || null, description: description || '',
      items: items?.length > 0 ? {
        create: items.map((i: any) => ({
          name: i.name, qty: i.qty, unit: i.unit || 'шт', nomenclatureId: i.nomenclatureId || null,
        })),
      } : undefined,
    },
    include: { items: true, _count: { select: { orders: true } } },
  })
  return NextResponse.json(sp, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { id, status } = await req.json()
  const sp = await prisma.specProject.update({ where: { id }, data: { status } })
  return NextResponse.json(sp)
}
