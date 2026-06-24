import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createToken, SessionUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
<<<<<<< HEAD
    if (!email || !password) {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 })
=======
    if (!email || !password) return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.password) return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    if (!user.active) return NextResponse.json({ error: 'Аккаунт деактивирован' }, { status: 403 })

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })

    const session: SessionUser = {
      id: user.id, name: user.name,
      email: user.email || '', role: user.role, slug: user.slug || ''
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
    }
    const token = await createToken(session)

<<<<<<< HEAD
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (!user || !user.active || !user.password) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
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
    const res = NextResponse.json({ ok: true, user: { ...sessionUser, slug: user.slug || undefined } })
    res.cookies.set('ukan_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    })
=======
    let redirect = '/admin'
    if (user.role === 'logist' && user.slug) redirect = `/rsp/${user.slug}`

    const res = NextResponse.json({ ok: true, user: session, redirect })
    const maxAge = 7 * 24 * 3600
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    res.headers.set('Set-Cookie', `ukan_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`)
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
    return res
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}