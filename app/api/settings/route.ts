// app/api/settings/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const [clients, users, suppliers, nomenclature] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, slug: true, active: true },
      orderBy: { name: 'asc' },
    }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.nomenclature.findMany({ orderBy: { name: 'asc' } }),
  ])

  return NextResponse.json({ clients, users, suppliers, nomenclature })
}
