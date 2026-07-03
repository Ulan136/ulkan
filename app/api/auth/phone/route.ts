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
