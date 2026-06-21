import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/auth'
import { generateCardId, generateTrackingLink, generateSlug } from '@/lib/ids'
import { notifyAdmins } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const { name, phone: raw, text } = await req.json()
    if (!name || !raw || !text) {
      return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 })
    }

    const phone = normalizePhone(raw)
    let user = await prisma.user.findUnique({ where: { phone } })

    if (!user) {
      let slug = generateSlug(name)
      const taken = await prisma.user.findUnique({ where: { slug } })
      if (taken) slug = `${slug}-${Date.now().toString(36)}`

      user = await prisma.user.create({
        data: { name, phone, role: 'client', slug, active: true },
      })
    }

    const cardId = generateCardId()
    const trackingLink = generateTrackingLink(cardId)
    const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    await prisma.order.create({
      data: {
        id: cardId,
        from: name,
        fromId: user.id,
        comment: text,
        source: 'external',
        status: 'Новая заявка',
        phone,
        trackingLink,
      },
    })

    await prisma.history.create({
      data: { cardId, action: 'Внешняя заявка', detail: phone, userName: name },
    })

    await notifyAdmins(`Внешняя заявка ${cardId} от ${name}`, cardId)

    return NextResponse.json({
      cardId,
      trackingUrl: `${base}/track?id=${cardId}`,
      clientUrl: `${base}/client/${user.slug}`,
    })
  } catch (e) {
    console.error('Track submit error:', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}