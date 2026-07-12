import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { generateCardId, generateTrackingLink, generateSlug, normalizePhone } from '@/lib/ids'
import { notifyAdmins } from '@/lib/notifications'
import { submitSchema } from '@/lib/dto/track.dto'
import { pushSignal } from '@/lib/pusherServer'

export async function POST(req: NextRequest) {
  try {
    const parsed = submitSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 })
    const { name, phone, text } = parsed.data

    const normPhone = normalizePhone(phone)
    let user = await prisma.user.findUnique({ where: { phone: normPhone } })
    if (!user) {
      let slug = generateSlug(name)
      const exists = await prisma.user.findUnique({ where: { slug } })
      if (exists) slug = slug + '-' + Date.now().toString().slice(-4)
      user = await prisma.user.create({
        data: { name, phone: normPhone, role: 'client', slug, active: true },
      })
    }

    const count = await prisma.order.count()
    const cardId = generateCardId(count)
    const trackingLink = generateTrackingLink(cardId)
    const base = process.env.NEXTAUTH_URL || 'https://ulkan.vercel.app'
    const clientUrl = `${base}/client/${user.slug}`

    await prisma.order.create({
      data: {
        id: cardId, from: name, fromId: user.id, phone: normPhone,
        comment: text, source: 'external', status: 'Новая заявка', trackingLink,
        history: { create: { action: 'Внешняя заявка создана', userName: name } },
      },
    })

    await notifyAdmins(`Внешняя заявка ${cardId} от ${name} (${normPhone})`, cardId)
    pushSignal('orders')

    return NextResponse.json({ cardId, trackingUrl: trackingLink, clientUrl }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
