import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { createToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.password) return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    if (!user.active) return NextResponse.json({ error: 'Аккаунт заблокирован' }, { status: 403 })

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })

    const session = { id: user.id, name: user.name, email: user.email ?? undefined, role: user.role, slug: user.slug ?? undefined }
    const token = await createToken(session)

    const res = NextResponse.json({ ok: true, user: session })
    res.cookies.set('ukan_session', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
    return res
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
