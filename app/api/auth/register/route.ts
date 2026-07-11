import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createToken } from '@/lib/auth'
import { normalizePhone, generateSlug } from '@/lib/ids'
import { registerSchema } from '@/lib/dto/auth.dto'

// POST /api/auth/register — регистрация нового клиента
export async function POST(req: NextRequest) {
  try {
    const parsed = registerSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Имя и телефон обязательны' }, { status: 400 })
    const { name, phone, email } = parsed.data

    const normPhone = normalizePhone(phone)
    const existing = await prisma.user.findUnique({ where: { phone: normPhone } })
    if (existing) return NextResponse.json({ error: 'Этот номер уже зарегистрирован' }, { status: 409 })

    let slug = generateSlug(name)
    const slugExists = await prisma.user.findUnique({ where: { slug } })
    if (slugExists) slug = slug + '-' + Date.now().toString().slice(-4)

    const user = await prisma.user.create({
      data: { name, phone: normPhone, email: email || null, role: 'client', slug, active: true },
    })

    const base = process.env.NEXTAUTH_URL || 'https://ulkan.vercel.app'
    const clientUrl = `${base}/client/${slug}`

    return NextResponse.json({ ok: true, slug, clientUrl }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
