import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const [users, projects, specProjects, suppliers, nomenclature, paymentStatuses] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, phone: true, role: true, slug: true, active: true, companyId: true, createdAt: true },
      orderBy: { name: 'asc' },
    }),
    prisma.project.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.specProject.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.nomenclature.findMany({ orderBy: { name: 'asc' } }),
    prisma.paymentStatus.findMany({ orderBy: { name: 'asc' } }),
  ])

  return NextResponse.json({ users, projects, specProjects, suppliers, nomenclature, paymentStatuses })
}