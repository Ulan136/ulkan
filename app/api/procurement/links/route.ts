import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireSession } from '@/lib/auth'

// Пары (заявка + товар), уже попавшие в какой-либо закуп. Нужны, чтобы убрать
// их из «Автозакупа» (не закупать повторно). Безопасно, если таблицы ещё нет.
export async function GET(req: NextRequest) {
  const auth = await requireSession(req, ['super_admin', 'bookkeeper'])
  if (!auth.ok) return auth.response
  try {
    const links = await (prisma as any).procurementLink.findMany({ select: { saleCardId: true, product: true } })
    return NextResponse.json(links)
  } catch {
    return NextResponse.json([])
  }
}
