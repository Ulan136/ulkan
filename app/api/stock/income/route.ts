import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { incomeStock } from '@/lib/stock'

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }

  try {
    const { name, qty, unit } = await req.json()
    if (!name || !qty) return NextResponse.json({ error: 'Название и количество обязательны' }, { status: 400 })

    // Найти Центр Склад
    const centerSklad = await prisma.supplier.findFirst({ where: { name: 'Центр Склад' } })
    if (!centerSklad) return NextResponse.json({ error: 'Центр Склад не найден в справочнике' }, { status: 404 })

    await incomeStock(name, Number(qty), centerSklad.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
