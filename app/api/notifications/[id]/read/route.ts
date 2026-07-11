import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  await prisma.notification.update({ where: { id }, data: { read: true } })
  return NextResponse.json({ ok: true })
}
