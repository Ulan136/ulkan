import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const limit = parseInt(searchParams.get('limit') || '10')

  if (!q || q.length < 1) {
    return NextResponse.json([])
  }

  const items = await prisma.nomenclature.findMany({
    where: {
      name: { contains: q, mode: 'insensitive' }
    },
    orderBy: { name: 'asc' },
    take: limit,
    select: { id: true, name: true, unit: true, cat: true }
  })

  return NextResponse.json(items)
}
