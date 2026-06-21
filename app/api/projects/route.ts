import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { generateProjectId } from '@/lib/ids'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const projects = await prisma.project.findMany({
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { name, clientId, description } = await req.json()
  if (!name) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })

  const project = await prisma.project.create({
    data: { id: generateProjectId(), name, clientId: clientId || null, description: description || '' },
  })
  return NextResponse.json(project, { status: 201 })
}