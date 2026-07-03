// app/api/track/submit/route.ts - внешняя заявка
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateCardId, generateTrackingLink, generateSlug } from '@/lib/ids'
import { normalizePhone } from '@/lib/display'
import { notifyAdmins } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const { name, phone, text } = await req.json()
    if (!name || !phone || !text) return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 })

    const normalized = normalizePhone(phone)

    // Найти или создать пользователя
    let user = await prisma.user.findUnique({ where: { phone: normalized } })
    if (!user) {
      let slug = generateSlug(name)
      const existing = await prisma.user.findUnique({ where: { slug } })
      if (existing) slug = slug + '-' + Date.now().toString().slice(-4)
      user = await prisma.user.create({
        data: { name, phone: normalized, role: 'client', slug, active: true },
      })
    }

    const cardId = generateCardId()
    const trackingLink = generateTrackingLink(cardId)
    const clientUrl = `${process.env.NEXTAUTH_URL || ''}/client/${user.slug}`

    await prisma.order.create({
      data: {
        id: cardId, from: name, fromId: user.id,
        screen: 'incoming', status: 'Новая заявка',
        source: 'external', comment: text,
        phone: normalized, trackingLink,
      },
    })

    await prisma.history.create({
      data: { cardId, action: 'Внешняя заявка', detail: name, userName: name },
    })

    await notifyAdmins(`Внешняя заявка ${cardId} от ${name} (${normalized})`, cardId)

    return NextResponse.json({ cardId, trackingUrl: trackingLink, clientUrl }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
