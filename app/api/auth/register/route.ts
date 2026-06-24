<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createToken, normalizePhone } from '@/lib/auth'
import { generateSlug } from '@/lib/ids'

function registerErrorMessage(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') return 'Телефон или email уже зарегистрирован'
    if (e.code === 'P2021') return 'База данных не обновлена. Выполните: npm run db:push && npm run db:seed'
  }
  const msg = e instanceof Error ? e.message : ''
  if (msg.includes('phone') || msg.includes('slug') || msg.includes('column') || msg.includes('does not exist')) {
    return 'База данных не обновлена под v1.0. Выполните: npm run db:push && npm run db:seed (с DATABASE_URL от Neon)'
  }
  return 'Ошибка сервера'
}

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
    return NextResponse.json({ error: registerErrorMessage(e) }, { status: 500 })
  }
}
=======
// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createToken, SessionUser } from '@/lib/auth'
import { generateSlug } from '@/lib/ids'
import { normalizePhone } from '@/lib/display'
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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
