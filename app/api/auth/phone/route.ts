import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createToken } from '@/lib/auth'
import { normalizePhone } from '@/lib/ids'
import { phoneSchema } from '@/lib/dto/auth.dto'

export async function POST(req: NextRequest) {
  try {
    const parsed = phoneSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Телефон обязателен' }, { status: 400 })
    const { phone } = parsed.data

    const normPhone = normalizePhone(phone)
    const user = await prisma.user.findUnique({ where: { phone: normPhone } })
    if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    if (!user.active) return NextResponse.json({ error: 'Аккаунт заблокирован' }, { status: 403 })

    const session = { id: user.id, name: user.name, phone: user.phone ?? undefined, role: user.role, slug: user.slug ?? undefined }
    const token = await createToken(session)

    const res = NextResponse.json({ ok: true, user: session, slug: user.slug })
    res.cookies.set('ukan_session', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
    return res
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
