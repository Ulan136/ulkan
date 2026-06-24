// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { normalizePhone } from '@/lib/display'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'super_admin') return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  try {
    const body = await req.json()
    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.role !== undefined) updateData.role = body.role
    if (body.email !== undefined) updateData.email = body.email || null
    if (body.phone !== undefined) updateData.phone = body.phone ? normalizePhone(body.phone) : null
    if (body.password) updateData.password = await bcrypt.hash(body.password, 10)
    if (body.companyId !== undefined) updateData.companyId = body.companyId || null
    if (body.slug !== undefined) updateData.slug = body.slug
    if (body.active !== undefined) updateData.active = body.active

    const user = await prisma.user.update({ where: { id: params.id }, data: updateData })
    return NextResponse.json(user)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
