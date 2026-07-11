import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { notifyAdmins } from '@/lib/notifications'
import { changeSchema } from '@/lib/dto/track.dto'

export async function POST(req: NextRequest) {
  try {
    const parsed = changeSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'cardId обязателен' }, { status: 400 })
    const { cardId, changeText, changePhone } = parsed.data

    await prisma.order.update({
      where: { id: cardId },
      data: { isChanged: true, changeText: changeText || '', changePhone: changePhone || '' },
    })
    await prisma.history.create({ data: { cardId, action: 'Клиент внёс изменение', detail: changeText || '', userName: 'Клиент' } })
    await notifyAdmins(`Клиент изменил заказ ${cardId}: ${changeText}`, cardId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
