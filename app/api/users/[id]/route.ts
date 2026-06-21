import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import bcrypt from 'bcryptjs'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const data: Record<string, unknown> = { ...body }

  if (body.password) {
    data.password = await bcrypt.hash(body.password, 10)
  }
  delete data.id

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, phone: true, role: true, slug: true, active: true, companyId: true },
  })
  return NextResponse.json(user)
}