import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createToken, normalizePhone } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { phone: raw } = await req.json()
    if (!raw) return NextResponse.json({ error: 'Телефон обязателен' }, { status: 400 })

    const phone = normalizePhone(raw)
    const user = await prisma.user.findUnique({ where: { phone } })
    if (!user || !user.active) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email || undefined,
      phone: user.phone || undefined,
      role: user.role,
      slug: user.slug || undefined,
    }

    const token = await createToken(sessionUser)
    const res = NextResponse.json({ ok: true, user: sessionUser, slug: user.slug })
    res.cookies.set('ukan_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    })
    return res
  } catch (e) {
    console.error('Phone login error:', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}