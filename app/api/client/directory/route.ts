import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

const ALLOWED = ['client', 'supplier_client', 'logist', 'super_admin', 'admin', 'bookkeeper']

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  if (!ALLOWED.includes(session.role)) {
    return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true, slug: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({
    logists: users.filter(u => u.role === 'logist'),
    suppliers: users.filter(u => u.role === 'supplier_client'),
    customers: users.filter(u => u.role === 'supplier_client'),
    privateClients: users.filter(u => u.role === 'client'),
    fromUsers: users.filter(u => u.role === 'client' || u.role === 'supplier_client'),
  })
}