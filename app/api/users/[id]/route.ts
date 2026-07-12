import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { normalizePhone } from '@/lib/ids'
import { pushSignal } from '@/lib/pusherServer'

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

    pushSignal('orders')  // переименование каскадит в from/to/resp карточек
    return NextResponse.json(user)
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'Email или телефон уже существует' }, { status: 409 })
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'super_admin') return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  const { id } = await params

  try {
    // Проверяем что не удаляем самого себя
    if (id === session.id) {
      return NextResponse.json({ error: 'Нельзя удалить самого себя' }, { status: 400 })
    }

    // Чистим связанные записи в одной транзакции, чтобы FK не блокировали удаление.
    // Заказы НЕ удаляем — только отвязываем контакт (история заказов сохраняется).
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { userId: id } }),          // уведомления
      prisma.dailyReport.deleteMany({ where: { logistId: id } }),         // смены (строки каскадом)
      prisma.order.updateMany({ where: { contactId: id }, data: { contactId: null } }), // контакт заказа
      prisma.user.updateMany({ where: { companyId: id }, data: { companyId: null } }),  // подпользователи
      prisma.user.delete({ where: { id } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e.code === 'P2003') {
      return NextResponse.json({ error: 'Нельзя удалить — остались связанные данные. Отключите пользователя.' }, { status: 409 })
    }
    if (e.code === 'P2025') {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }
    console.error('delete user error:', e)
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}
