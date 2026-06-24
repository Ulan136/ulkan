import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
<<<<<<< HEAD
import { getSessionFromRequest } from '@/lib/auth'
import { generateSlug } from '@/lib/ids'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, phone: true, role: true, slug: true, active: true, companyId: true, createdAt: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
  }

  const { name, email, phone, password, role, slug, companyId } = await req.json()
  if (!name || !role) {
    return NextResponse.json({ error: 'Имя и роль обязательны' }, { status: 400 })
  }

  const user = await prisma.user.create({
    data: {
      name,
      role,
      slug: slug || generateSlug(name),
      companyId: companyId || null,
      active: true,
      email: email ? email.toLowerCase().trim() : null,
      phone: phone || null,
      password: password ? await bcrypt.hash(password, 10) : null,
    },
    select: { id: true, name: true, email: true, phone: true, role: true, slug: true, active: true },
  })

  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  let accessUrl = `${base}/admin`
  if (user.role === 'logist' && user.slug) accessUrl = `${base}/rsp/${user.slug}`
  else if ((user.role === 'client' || user.role === 'supplier_client') && user.slug) {
    accessUrl = `${base}/client/${user.slug}`
  }

  return NextResponse.json({ user, accessUrl }, { status: 201 })
}
=======
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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
