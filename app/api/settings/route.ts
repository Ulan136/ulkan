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

  // priceType — с фолбэком (колонки может ещё не быть в БД до ALTER).
  const uSel = { id: true, name: true, phone: true, email: true, role: true, companyId: true, slug: true, active: true, createdAt: true }
  let users: any[] = []
  if (isAdmin) {
    try { users = await prisma.user.findMany({ select: { ...uSel, priceType: true }, orderBy: { createdAt: 'asc' } }) }
    catch { users = await prisma.user.findMany({ select: uSel, orderBy: { createdAt: 'asc' } }) }
  }

  const [projects, specProjects, suppliers, paymentStatuses] = await Promise.all([
    prisma.project.findMany({ include: { _count: { select: { orders: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.specProject.findMany({ include: { items: true, _count: { select: { orders: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.paymentStatus.findMany({ orderBy: { name: 'asc' } }),
  ])

  // Правила автоподстановки — только админам; безопасно, если таблицы ещё нет.
  let categoryRules: any[] = []
  if (isAdmin) {
    try { categoryRules = await (prisma as any).categoryRule.findMany() } catch { categoryRules = [] }
  }

  // Поставщик может быть пользователем (клиент/заказчик-поставщик/филиал).
  // Отдаём ИМЕНА таких пользователей всем (нужно логисту для выбора поставщика).
  const supUsers = await prisma.user.findMany({
    where: { role: { in: ['supplier_client', 'client', 'branch'] }, active: true },
    select: { name: true }, orderBy: { name: 'asc' },
  })
  const supplierUsers = supUsers.map(u => u.name).filter(Boolean)

  return NextResponse.json({ users, projects, specProjects, suppliers, nomenclature: [], paymentStatuses, categoryRules, supplierUsers })
}
