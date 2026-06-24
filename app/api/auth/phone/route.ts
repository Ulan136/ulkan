<<<<<<< HEAD
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
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('phone') || msg.includes('column') || msg.includes('does not exist')) {
      return NextResponse.json({ error: 'База данных не обновлена. Выполните: npm run db:push' }, { status: 500 })
    }
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
=======
// app/api/auth/phone/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createToken, SessionUser } from '@/lib/auth'
import { normalizePhone } from '@/lib/display'

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    if (!phone) return NextResponse.json({ error: 'Введите телефон' }, { status: 400 })

    const normalized = normalizePhone(phone)
    const user = await prisma.user.findUnique({ where: { phone: normalized } })
    if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    if (!user.active) return NextResponse.json({ error: 'Аккаунт деактивирован' }, { status: 403 })

    const session: SessionUser = {
      id: user.id, name: user.name,
      phone: user.phone || '', role: user.role, slug: user.slug || ''
    }
    const token = await createToken(session)

    const res = NextResponse.json({ ok: true, user: session, slug: user.slug || '' })
    const maxAge = 7 * 24 * 3600
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    res.headers.set('Set-Cookie', `ukan_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`)
    return res
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
