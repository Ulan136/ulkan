// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createToken, SessionUser } from '@/lib/auth'
import { generateSlug, normalizePhone } from '@/lib/display'
import { notifyAdmins } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const { name, phone, email } = await req.json()
    if (!name || !phone) return NextResponse.json({ error: 'Заполните обязательные поля' }, { status: 400 })

    const normalized = normalizePhone(phone)

    const existing = await prisma.user.findUnique({ where: { phone: normalized } })
    if (existing) {
      // Уже зарегистрирован — просто войти
      const session: SessionUser = { id: existing.id, name: existing.name, phone: existing.phone || '', role: existing.role, slug: existing.slug || '' }
      const token = await createToken(session)
      const clientUrl = `${process.env.NEXTAUTH_URL || ''}/client/${existing.slug}`
      const res = NextResponse.json({ ok: true, user: session, slug: existing.slug, clientUrl, existing: true })
      const maxAge = 7 * 24 * 3600
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
      res.headers.set('Set-Cookie', `ukan_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`)
      return res
    }

    let slug = generateSlug(name)
    // Проверяем уникальность slug
    const slugExisting = await prisma.user.findUnique({ where: { slug } })
    if (slugExisting) slug = slug + '-' + Date.now().toString().slice(-4)

    const user = await prisma.user.create({
      data: { name, phone: normalized, email: email || null, role: 'client', slug, active: true }
    })

    const session: SessionUser = { id: user.id, name: user.name, phone: user.phone || '', role: user.role, slug: user.slug || '' }
    const token = await createToken(session)
    const clientUrl = `${process.env.NEXTAUTH_URL || ''}/client/${user.slug}`

    await notifyAdmins(`Новый клиент зарегистрировался: ${name} (${normalized})`)

    const res = NextResponse.json({ ok: true, user: session, slug: user.slug, clientUrl })
    const maxAge = 7 * 24 * 3600
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    res.headers.set('Set-Cookie', `ukan_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`)
    return res
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
