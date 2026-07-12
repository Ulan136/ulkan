import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  // Список пользователей нужен только админ-оболочке (super_admin/bookkeeper) для
  // селектов. Порталам (логист и т.п.) settings нужен только ради suppliers —
  // им список пользователей не отдаём. И в любом случае — без password-хэша.
  const isAdmin = ['super_admin', 'bookkeeper'].includes(auth.session?.role || '')

  const [users, projects, specProjects, suppliers, paymentStatuses] = await Promise.all([
    isAdmin
      ? prisma.user.findMany({
          select: { id: true, name: true, phone: true, email: true, role: true, companyId: true, slug: true, active: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),
    prisma.project.findMany({ include: { _count: { select: { orders: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.specProject.findMany({ include: { items: true, _count: { select: { orders: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.paymentStatus.findMany({ orderBy: { name: 'asc' } }),
  ])

  return NextResponse.json({ users, projects, specProjects, suppliers, nomenclature: [], paymentStatuses })
}
