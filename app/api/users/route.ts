// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, slug: true, active: true, createdAt: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
  }

  const { name, email, password, role, slug } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 })
  }

  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), password: hash, role: role || 'admin', slug },
    select: { id: true, name: true, email: true, role: true, slug: true, active: true },
  })
  return NextResponse.json(user, { status: 201 })
}
