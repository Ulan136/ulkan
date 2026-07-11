import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { session } = auth

  const notifications = await prisma.notification.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json(notifications)
}
