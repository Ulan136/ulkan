import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  const stock = await prisma.stock.findMany({ include: { supplier: true, nomenclature: true }, orderBy: { name: 'asc' } })
  return NextResponse.json(stock)
}
