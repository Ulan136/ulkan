// app/api/orders/[id]/history/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params

  const history = await prisma.history.findMany({
    where: { cardId: id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(history)
}
