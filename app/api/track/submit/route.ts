<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/auth'
import { generateCardId, generateTrackingLink, generateSlug } from '@/lib/ids'
=======
// app/api/track/submit/route.ts - внешняя заявка
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateCardId, generateTrackingLink, generateSlug } from '@/lib/ids'
import { normalizePhone } from '@/lib/display'
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
import { notifyAdmins } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
<<<<<<< HEAD
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
=======
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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
      })
    }

    const cardId = generateCardId()
    const trackingLink = generateTrackingLink(cardId)
<<<<<<< HEAD
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
=======
    const clientUrl = `${process.env.NEXTAUTH_URL || ''}/client/${user.slug}`

    await prisma.order.create({
      data: {
        id: cardId, from: name, fromId: user.id,
        screen: 'incoming', status: 'Новая заявка',
        source: 'external', comment: text,
        phone: normalized, trackingLink,
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
      },
    })

    await prisma.history.create({
<<<<<<< HEAD
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
=======
      data: { cardId, action: 'Внешняя заявка', detail: name, userName: name },
    })

    await notifyAdmins(`Внешняя заявка ${cardId} от ${name} (${normalized})`, cardId)

    return NextResponse.json({ cardId, trackingUrl: trackingLink, clientUrl }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
