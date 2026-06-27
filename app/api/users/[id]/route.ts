import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { normalizePhone } from '@/lib/ids'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'super_admin') return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  const updateData: any = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.email !== undefined) updateData.email = body.email || null
  if (body.phone !== undefined) updateData.phone = body.phone ? normalizePhone(body.phone) : null
  if (body.role !== undefined) updateData.role = body.role
  if (body.slug !== undefined) updateData.slug = body.slug
  if (body.active !== undefined) updateData.active = body.active
  if (body.companyId !== undefined) updateData.companyId = body.companyId || null
  if (body.password) updateData.password = await bcrypt.hash(body.password, 10)

  try {
    // Получаем старое имя перед обновлением
    const oldUser = await prisma.user.findUnique({ where: { id } })
    
    const user = await prisma.user.update({ where: { id }, data: updateData })

    // Если имя изменилось — обновляем все позиции и карточки
    if (body.name && oldUser && oldUser.name !== body.name) {
      await Promise.all([
        // Обновляем resp в позициях
        prisma.position.updateMany({
          where: { resp: oldUser.name },
          data: { resp: body.name }
        }),
        // Обновляем from в карточках
        prisma.order.updateMany({
          where: { from: oldUser.name },
          data: { from: body.name }
        }),
        // Обновляем to в карточках
        prisma.order.updateMany({
          where: { to: oldUser.name },
          data: { to: body.name }
        }),
      ])
    }

    return NextResponse.json(user)
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'Email или телефон уже существует' }, { status: 409 })
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}
