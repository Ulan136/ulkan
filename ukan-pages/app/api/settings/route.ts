// app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    const [users, projects, specProjects, suppliers, nomenclature, paymentStatuses] = await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.project.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.specProject.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } }),
      prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
      prisma.nomenclature.findMany({ orderBy: { name: 'asc' } }),
      prisma.paymentStatus.findMany(),
    ])
    return NextResponse.json({ users, projects, specProjects, suppliers, nomenclature, paymentStatuses })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
