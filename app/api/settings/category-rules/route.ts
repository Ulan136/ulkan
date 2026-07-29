import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { pushSignal } from '@/lib/pusherServer'

// Правила автоподстановки поставщика/логиста по группе каталога.
// GET — список (безопасно: если таблицы ещё нет в БД до SQL-миграции — []).
export async function GET(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response
  try {
    const rules = await (prisma as any).categoryRule.findMany()
    return NextResponse.json(rules)
  } catch {
    return NextResponse.json([]) // таблица ещё не создана — не падаем
  }
}

// PUT — upsert одного правила по ключу категории.
export async function PUT(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response
  const { category, supplierName, supplierId, logistName } = await req.json()
  if (!category) return NextResponse.json({ error: 'Категория обязательна' }, { status: 400 })
  try {
    const data = { supplierName: supplierName || '', supplierId: supplierId || '', logistName: logistName || '' }
    const rule = await (prisma as any).categoryRule.upsert({
      where: { category },
      update: data,
      create: { category, ...data },
    })
    await pushSignal('settings')
    return NextResponse.json(rule)
  } catch (e: any) {
    // Таблицы ещё нет — подсказываем выполнить SQL-миграцию
    return NextResponse.json({ error: 'Таблица CategoryRule не создана в БД. Выполните SQL-миграцию.' }, { status: 500 })
  }
}
