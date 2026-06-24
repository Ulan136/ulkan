<<<<<<< HEAD
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

=======
// app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

<<<<<<< HEAD
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
=======
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
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
