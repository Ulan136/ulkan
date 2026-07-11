import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || undefined
  const limit = parseInt(searchParams.get('limit') || '50')
  const movements = await prisma.stockMovement.findMany({
    where: type ? { type } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json(movements)
}
