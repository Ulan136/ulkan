import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createToken } from '@/lib/auth'
import { normalizePhone } from '@/lib/ids'
import { phoneSchema } from '@/lib/dto/auth.dto'

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null)
    const parsed = phoneSchema.safeParse(raw)
    if (!parsed.success) return NextResponse.json({ error: 'Телефон обязателен' }, { status: 400 })
    const { phone } = parsed.data
    const remember = raw?.remember !== false // по умолчанию запоминаем

    const normPhone = normalizePhone(phone)
    const user = await prisma.user.findUnique({ where: { phone: normPhone } })
    if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    if (!user.active) return NextResponse.json({ error: 'Аккаунт заблокирован' }, { status: 403 })

    const session = { id: user.id, name: user.name, phone: user.phone ?? undefined, role: user.role, slug: user.slug ?? undefined }
    const token = await createToken(session)

    const res = NextResponse.json({ ok: true, user: session, slug: user.slug })
    // secure в проде: без него iOS Safari/PWA может сбрасывать cookie → «постоянный выход».
    res.cookies.set('ukan_session', token, { httpOnly: true, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', ...(remember ? { maxAge: 60 * 60 * 24 * 365 } : {}) })
    return res
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
