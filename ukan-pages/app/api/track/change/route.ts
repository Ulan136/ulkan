// app/api/track/change/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyAdmins } from '@/lib/notifications'
import { normalizePhone } from '@/lib/display'

export async function POST(req: NextRequest) {
  try {
    const { cardId, changeText, changePhone } = await req.json()
    if (!cardId || !changeText || !changePhone) return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 })

    const order = await prisma.order.findUnique({ where: { id: cardId } })
    if (!order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })

    await prisma.order.update({
      where: { id: cardId },
      data: { isChanged: true, changeText, changePhone: normalizePhone(changePhone) },
    })

    await prisma.history.create({
      data: { cardId, action: 'Изменение от клиента', detail: changeText, userName: order.from },
    })

    await notifyAdmins(`Заказ ${cardId} изменён клиентом: ${changeText}`, cardId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
