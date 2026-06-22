// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generateSlug } from '@/lib/ids'
import { normalizePhone } from '@/lib/display'

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'super_admin') return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  try {
    const { name, role, email, phone, password, companyId, slug: rawSlug, active = true } = await req.json()
    if (!name || !role) return NextResponse.json({ error: 'Заполните обязательные поля' }, { status: 400 })

    const slug = rawSlug || generateSlug(name)
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null
    const normalizedPhone = phone ? normalizePhone(phone) : null

    const user = await prisma.user.create({
      data: {
        name, role, email: email || null,
        phone: normalizedPhone, password: hashedPassword,
        companyId: companyId || null, slug, active,
      },
    })

    const base = process.env.NEXTAUTH_URL || ''
    let accessUrl = ''
    if (role === 'logist') accessUrl = `${base}/rsp/${slug}`
    else if (['client', 'supplier_client'].includes(role)) accessUrl = `${base}/client/${slug}`

    return NextResponse.json({ user, accessUrl }, { status: 201 })
  } catch (e: unknown) {
    console.error(e)
    const msg = e instanceof Error && e.message.includes('Unique') ? 'Email, телефон или slug уже используется' : 'Ошибка сервера'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
