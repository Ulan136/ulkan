import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const history = await prisma.history.findMany({
    where: { cardId: id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(history)
}
