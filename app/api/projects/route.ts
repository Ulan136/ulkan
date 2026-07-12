import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { generateProjectId } from '@/lib/ids'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const projects = await prisma.project.findMany({
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response
  const { name, clientId, description } = await req.json()
  const project = await prisma.project.create({
    data: { id: generateProjectId(await prisma.project.count()), name, clientId: clientId || null, description: description || '' },
    include: { _count: { select: { orders: true } } },
  })
  return NextResponse.json(project, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response
  const { id, status } = await req.json()
  const project = await prisma.project.update({ where: { id }, data: { status } })
  return NextResponse.json(project)
}
