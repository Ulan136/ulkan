import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const items = await prisma.nomenclature.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { name, unit, cat } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Наименование обязательно' }, { status: 400 })
  }

  const item = await prisma.nomenclature.create({
    data: {
      name: name.trim(),
      unit: unit?.trim() || 'шт',
      cat: cat?.trim() || '',
    },
  })
  return NextResponse.json(item, { status: 201 })
}