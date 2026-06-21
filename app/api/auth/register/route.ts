import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createToken, normalizePhone } from '@/lib/auth'
import { generateSlug } from '@/lib/ids'

export async function POST(req: NextRequest) {
  try {
    const { name, phone: raw, email } = await req.json()
    if (!name || !raw) {
      return NextResponse.json({ error: 'Имя и телефон обязательны' }, { status: 400 })
    }

    const phone = normalizePhone(raw)
    const existing = await prisma.user.findUnique({ where: { phone } })
    if (existing) {
      return NextResponse.json({ error: 'Телефон уже зарегистрирован' }, { status: 409 })
    }

    let slug = generateSlug(name)
    const slugTaken = await prisma.user.findUnique({ where: { slug } })
    if (slugTaken) slug = `${slug}-${Date.now().toString(36)}`

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email: email?.toLowerCase().trim() || null,
        role: 'client',
        slug,
        active: true,
      },
    })

    const sessionUser = {
      id: user.id,
      name: user.name,
      phone: user.phone || undefined,
      role: user.role,
      slug: user.slug || undefined,
    }

    const token = await createToken(sessionUser)
    const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const clientUrl = `${base}/client/${slug}`

    const res = NextResponse.json({ ok: true, slug, clientUrl, user: sessionUser })
    res.cookies.set('ukan_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    })
    return res
  } catch (e) {
    console.error('Register error:', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}