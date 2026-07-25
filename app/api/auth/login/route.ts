import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { createToken } from '@/lib/auth'
import { loginSchema } from '@/lib/dto/auth.dto'

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null)
    const parsed = loginSchema.safeParse(raw)
    if (!parsed.success) return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 })
    const { email, password } = parsed.data
    const remember = raw?.remember !== false // по умолчанию запоминаем

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.password) return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    if (!user.active) return NextResponse.json({ error: 'Аккаунт заблокирован' }, { status: 403 })

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })

    const session = { id: user.id, name: user.name, email: user.email ?? undefined, role: user.role, slug: user.slug ?? undefined }
    const token = await createToken(session)

    const res = NextResponse.json({ ok: true, user: session })
    // remember → постоянная cookie на год; иначе сессионная (до закрытия браузера).
    res.cookies.set('ukan_session', token, { httpOnly: true, path: '/', sameSite: 'lax', ...(remember ? { maxAge: 60 * 60 * 24 * 365 } : {}) })
    return res
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
