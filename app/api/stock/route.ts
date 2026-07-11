import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const stock = await prisma.stock.findMany({ include: { supplier: true, nomenclature: true }, orderBy: { name: 'asc' } })
  return NextResponse.json(stock)
}
