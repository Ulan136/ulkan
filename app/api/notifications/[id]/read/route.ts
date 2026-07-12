import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  // updateMany со scope по userId: чужое уведомление не пометить (count=0, без throw).
  await prisma.notification.updateMany({ where: { id, userId: auth.session?.id }, data: { read: true } })
  return NextResponse.json({ ok: true })
}
