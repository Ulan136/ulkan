import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyAdmins } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const { cardId, changeText, changePhone } = await req.json()
    if (!cardId || !changeText) {
      return NextResponse.json({ error: 'Заполните поля' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({ where: { id: cardId } })
    if (!order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })

    await prisma.order.update({
      where: { id: cardId },
      data: { isChanged: true, changeText, changePhone: changePhone || '' },
    })

    await prisma.history.create({
      data: { cardId, action: 'Изменение от клиента', detail: changeText, userName: 'Клиент' },
    })

    await notifyAdmins(`Клиент изменил заявку ${cardId}`, cardId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Track change error:', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}