import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { requireSession, getSessionFromRequest } from '@/lib/auth'
import { generateSlug, normalizePhone } from '@/lib/ids'

// Безопасный набор полей пользователя (без password-хэша).
const USER_PUBLIC = { id: true, name: true, phone: true, email: true, role: true, companyId: true, slug: true, active: true, createdAt: true } as const

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response
  const users = await prisma.user.findMany({ select: USER_PUBLIC, orderBy: { createdAt: 'asc' } })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'super_admin') return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  try {
    const body = await req.json()
    const { name, role, email, phone, password, companyId, slug: slugRaw } = body

    let hashedPassword: string | null = null
    if (password) hashedPassword = await bcrypt.hash(password, 10)

    let slug = slugRaw || (name ? generateSlug(name) : null)
    if (slug) {
      const exists = await prisma.user.findUnique({ where: { slug } })
      if (exists) slug = slug + '-' + Date.now().toString().slice(-4)
    }

    const normPhone = phone ? normalizePhone(phone) : null

    const user = await prisma.user.create({
      data: {
        name, role: role || 'client',
        email: email || null, phone: normPhone,
        password: hashedPassword,
        companyId: companyId || null,
        slug: slug || null, active: true,
      },
    })

    const base = process.env.NEXTAUTH_URL || 'https://ulkan.vercel.app'
    let accessUrl = ''
    if (role === 'client' || role === 'supplier_client') accessUrl = `${base}/client/${user.slug}`
    else if (role === 'logist') accessUrl = `${base}/rsp/${user.slug}`

    return NextResponse.json({ user, accessUrl }, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'Email или телефон уже существует' }, { status: 409 })
    console.error(e)
    return NextResponse.json({ error: 'Ошибка создания пользователя' }, { status: 500 })
  }
}
