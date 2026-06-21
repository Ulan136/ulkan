import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    console.error('Settings query error:', e)
    return fallback
  }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const [users, projects, specProjects, suppliers, nomenclature, paymentStatuses] = await Promise.all([
    safeQuery(
      () => prisma.user.findMany({
        select: { id: true, name: true, email: true, phone: true, role: true, slug: true, active: true, companyId: true, createdAt: true },
        orderBy: { name: 'asc' },
      }),
      [],
    ),
    safeQuery(() => prisma.project.findMany({ orderBy: { createdAt: 'desc' } }), []),
    safeQuery(
      () => prisma.specProject.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } }),
      [],
    ),
    safeQuery(() => prisma.supplier.findMany({ orderBy: { name: 'asc' } }), []),
    safeQuery(() => prisma.nomenclature.findMany({ orderBy: { name: 'asc' } }), []),
    safeQuery(() => prisma.paymentStatus.findMany({ orderBy: { name: 'asc' } }), []),
  ])

  return NextResponse.json({ users, projects, specProjects, suppliers, nomenclature, paymentStatuses })
}