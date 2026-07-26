import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

// GET /api/history?user=<имя>&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=
// Журнал действий (как в 1С): кто/что/когда. Фильтры по пользователю и датам.
export async function GET(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const user = (searchParams.get('user') || '').trim()
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '400'), 2000)

  const where: any = {}
  if (user) where.userName = { equals: user, mode: 'insensitive' }
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from + 'T00:00:00')
    if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999')
  }

  const rows = await prisma.history.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit })
  return NextResponse.json(rows)
}
