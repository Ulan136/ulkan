import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { resolvePrice } from '@/services/pricing'

// GET /api/nomenclature/price?name=<name1c>&type=retail|opt
// Цена позиции из номенклатуры по имени и типу цены. 0 — не нашли/колонок нет.
export async function GET(req: NextRequest) {
  const auth = await requireSession(req)
  if (!auth.ok) return auth.response
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name') || ''
  const type = searchParams.get('type') === 'opt' ? 'opt' : 'retail'
  const price = await resolvePrice(name, type)
  return NextResponse.json({ price: price ?? 0 })
}
